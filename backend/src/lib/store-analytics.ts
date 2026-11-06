import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { storeIdentity } from "./store-installation";

const retention = 91 * 86400_000;
let nextCleanup = 0;
let cleanup: Promise<unknown> | undefined;
export function analyticsScope() {
    const identity = storeIdentity();
    return identity ? `${identity.companyId}:${identity.storeId}` : "legacy-installation";
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sessionHash = (scope: string, session: string) => hash(`${scope}:${session}`);
// PostgreSQL has no TTL indexes. Purge indexed expired rows at startup/first use
// and at most hourly thereafter; a failed purge is retried, never hidden.
export async function purgeExpiredAnalytics() {
    await prisma.storeAnalytics.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
async function ready() {
    if (Date.now() < nextCleanup) return;
    if (!cleanup) cleanup = purgeExpiredAnalytics().then(() => {
        nextCleanup = Date.now() + 3600_000;
    }).finally(() => { cleanup = undefined; });
    await cleanup;
}
async function insertOnce(id: string, document: {
    scope: string; session: string; kind: string; test: boolean; at: number;
    page?: string; productId?: string; productName?: string; stage?: string; stageRank?: number;
}) {
    await ready();
    // One INSERT ON CONFLICT DO NOTHING preserves the first timestamp under concurrency.
    await prisma.storeAnalytics.createMany({ data: [{
        ...document, id, at: new Date(document.at), expiresAt: new Date(document.at + retention),
    }], skipDuplicates: true });
}
export async function recordPage(session: string, page: string, test: boolean) {
    const scope = analyticsScope();
    let product: { id: string; nameFr: string } | null = null;
    if (page.startsWith("/products/")) {
        product = await prisma.product.findFirst({
            where: { slug: page.slice(10), status: "ACTIVE" }, select: { id: true, nameFr: true },
        });
        if (!product) return false;
    }
    await insertOnce(hash(`${scope}:page:${session}:${page}:${test}`), {
        scope, session: sessionHash(scope, session), kind: "page", page, test, at: Date.now(),
        ...(product ? { productId: product.id, productName: product.nameFr } : {}),
    });
    return true;
}
export async function recordOrderConversion(orderId: string, createdAt: Date, session: string | undefined, test: boolean) {
    if (!session || !/^[a-f0-9-]{36}$/i.test(session) || Date.now() - createdAt.getTime() > 30 * 60_000) return;
    const scope = analyticsScope(), hashed = sessionHash(scope, session);
    const found = await prisma.storeAnalytics.findFirst({ where: {
        scope, session: hashed, kind: "page", test,
        at: { lte: createdAt, gte: new Date(createdAt.getTime() - 30 * 60_000) },
    }, select: { id: true } });
    if (!found) return;
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) return;
    await insertOnce(hash(`${scope}:order:${orderId}`), {
        scope, session: hashed, kind: "order", test, at: createdAt.getTime(), stage: order.status,
        stageRank: { PENDING: 0, CONFIRMED: 1, SHIPPED: 2, DELIVERED: 3, CANCELLED: 4 }[order.status],
    });
}
export async function recordCart(session: string, page: string, test: boolean) {
    if (!page.startsWith("/products/")) return false;
    const product = await prisma.product.findFirst({ where: { slug: page.slice(10), status: "ACTIVE" }, select: { id: true } });
    if (!product) return false;
    const scope = analyticsScope();
    await insertOnce(hash(`${scope}:cart:${session}:${test}`), {
        scope, session: sessionHash(scope, session), kind: "cart", test, at: Date.now(),
    });
    return true;
}
/** Update only attributed orders; never reconstruct history or create another event. */
export async function recordOrderStage(orderId: string, stage: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED") {
    const scope = analyticsScope(), rank = { PENDING: 0, CONFIRMED: 1, SHIPPED: 2, DELIVERED: 3, CANCELLED: 4 }[stage];
    await prisma.storeAnalytics.updateMany({ where: {
        id: hash(`${scope}:order:${orderId}`), scope,
        OR: [{ stageRank: { lte: rank } }, { stageRank: null }],
    }, data: { stage, stageRank: rank } });
}
export async function readAnalytics(days: number) {
    await ready();
    const scope = analyticsScope(), end = new Date(), start = new Date(end.getTime() - days * 86400_000);
    const filter = Prisma.sql`scope = ${scope} AND test = false AND at >= ${start} AND at <= ${end}`;
    const [sessions, groups, products, first] = await Promise.all([
        prisma.$queryRaw<Array<{ visits: bigint; converted: bigint; cart: bigint; checkout: bigint }>>(Prisma.sql`
            WITH visits AS (
                SELECT session, bool_or(kind = 'page') AS viewed, bool_or(kind = 'order') AS ordered,
                    bool_or(kind = 'cart') AS cart, bool_or(kind = 'page' AND page = '/checkout') AS checkout
                FROM store_analytics WHERE ${filter} GROUP BY session
            ) SELECT count(*) AS visits, count(*) FILTER (WHERE ordered) AS converted,
                count(*) FILTER (WHERE cart) AS cart, count(*) FILTER (WHERE checkout) AS checkout
            FROM visits WHERE viewed`),
        prisma.storeAnalytics.groupBy({ by: ["kind", "stage"], where: { scope, test: false, at: { gte: start, lte: end } }, _count: true }),
        prisma.$queryRaw<Array<{ id: string; name: string; views: bigint }>>(Prisma.sql`
            SELECT "productId" AS id, (array_agg("productName" ORDER BY at DESC, id))[1] AS name, count(*) AS views
            FROM store_analytics WHERE ${filter} AND kind = 'page' AND "productId" IS NOT NULL
            GROUP BY "productId" ORDER BY views DESC, "productId" LIMIT 20`),
        prisma.storeAnalytics.findFirst({ where: { scope, test: false, kind: "page" }, orderBy: { at: "asc" }, select: { at: true } }),
    ]);
    const visits = Number(sessions[0]?.visits ?? 0), convertedVisits = Number(sessions[0]?.converted ?? 0);
    const count = (kind: string, stages?: string[]) => groups.filter(g => g.kind === kind && (!stages || stages.includes(g.stage || ""))).reduce((sum, g) => sum + g._count, 0);
    const productViews = await prisma.storeAnalytics.count({ where: { scope, test: false, at: { gte: start, lte: end }, kind: "page", productId: { not: null } } });
    return {
        days, start: start.toISOString(), end: end.toISOString(), trackingSince: first?.at.toISOString() ?? null,
        visits, convertedVisits, orderRate: visits ? Number(((convertedVisits / visits) * 100).toFixed(2)) : null,
        pageViews: count("page"), productViews, attributedOrders: count("order"),
        funnel: {
            cartVisits: Number(sessions[0]?.cart ?? 0), checkoutVisits: Number(sessions[0]?.checkout ?? 0),
            confirmedOrders: count("order", ["CONFIRMED", "SHIPPED", "DELIVERED"]),
            shippedOrders: count("order", ["SHIPPED", "DELIVERED"]), deliveredOrders: count("order", ["DELIVERED"]),
            cancelledOrders: count("order", ["CANCELLED"]), unknownOrders: count("order", [""]),
        }, products: products.map(p => ({ ...p, views: Number(p.views) })),
    };
}
