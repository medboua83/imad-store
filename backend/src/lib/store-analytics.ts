import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { storeIdentity } from "./store-installation";

const collection = "store_analytics";
const retention = 91 * 86400_000;
let indexes: Promise<unknown> | undefined;
export function analyticsScope() {
    const identity = storeIdentity();
    return identity ? `${identity.companyId}:${identity.storeId}` : "legacy-installation";
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sessionHash = (scope: string, session: string) => hash(`${scope}:${session}`);
async function ready() {
    if (!indexes)
        indexes = prisma
            .$runCommandRaw({
                createIndexes: collection,
                indexes: [
                    { key: { scope: 1, test: 1, at: 1 }, name: "scope_period" },
                    { key: { scope: 1, session: 1, kind: 1 }, name: "scope_session" },
                    { key: { expiresAt: 1 }, name: "analytics_retention", expireAfterSeconds: 0 },
                ],
            })
            .catch((error) => {
                indexes = undefined;
                throw error;
            });
    await indexes;
}
async function insertOnce(id: string, document: Record<string, unknown>) {
    await ready();
    try {
        await prisma.$runCommandRaw({
            update: collection,
            maxTimeMS: 1500,
            updates: [
                {
                    q: { _id: id },
                    u: {
                        $setOnInsert: {
                            ...document,
                            expiresAt: {
                                $date: new Date(Number(document.at) + retention).toISOString(),
                            },
                        },
                    },
                    upsert: true,
                },
            ],
        });
    } catch (error) {
        // Concurrent upserts may race on MongoDB's built-in unique _id index.
        if (!/E11000|duplicate key/.test(String((error as Error).message))) throw error;
    }
}
export async function recordPage(session: string, page: string, test: boolean) {
    const scope = analyticsScope();
    let product: { id: string; nameFr: string } | null = null;
    if (page.startsWith("/products/")) {
        product = await prisma.product.findFirst({
            where: { slug: page.slice(10), status: "ACTIVE" },
            select: { id: true, nameFr: true },
        });
        if (!product) return false;
    }
    await insertOnce(hash(`${scope}:page:${session}:${page}:${test}`), {
        scope,
        session: sessionHash(scope, session),
        kind: "page",
        page,
        test,
        at: Date.now(),
        ...(product ? { productId: product.id, productName: product.nameFr } : {}),
    });
    return true;
}
export async function recordOrderConversion(
    orderId: string,
    createdAt: Date,
    session: string | undefined,
    test: boolean,
) {
    if (
        !session ||
        !/^[a-f0-9-]{36}$/i.test(session) ||
        Date.now() - createdAt.getTime() > 30 * 60_000
    )
        return;
    const scope = analyticsScope(),
        hashed = sessionHash(scope, session);
    const found = (await prisma.$runCommandRaw({
        find: collection,
        filter: {
            scope,
            session: hashed,
            kind: "page",
            test,
            at: { $lte: createdAt.getTime(), $gte: createdAt.getTime() - 30 * 60_000 },
        },
        limit: 1,
        maxTimeMS: 1500,
    })) as unknown as { cursor: { firstBatch: unknown[] } };
    if (!found.cursor.firstBatch.length) return;
    // The order id is irreversible here; conversion retries cannot count another order.
    await insertOnce(hash(`${scope}:order:${orderId}`), {
        scope,
        session: hashed,
        kind: "order",
        test,
        at: createdAt.getTime(),
    });
}
export async function readAnalytics(days: number) {
    const scope = analyticsScope(),
        end = Date.now(),
        start = end - days * 86400_000;
    const result = (await prisma.$runCommandRaw({
        aggregate: collection,
        pipeline: [
            { $match: { scope, test: false, at: { $gte: start, $lte: end } } },
            {
                $facet: {
                    sessions: [
                        {
                            $group: {
                                _id: "$session",
                                viewed: { $max: { $cond: [{ $eq: ["$kind", "page"] }, 1, 0] } },
                                ordered: { $max: { $cond: [{ $eq: ["$kind", "order"] }, 1, 0] } },
                            },
                        },
                        { $match: { viewed: 1 } },
                        {
                            $group: {
                                _id: null,
                                visits: { $sum: 1 },
                                convertedVisits: { $sum: "$ordered" },
                            },
                        },
                    ],
                    pages: [{ $match: { kind: "page" } }, { $count: "count" }],
                    orders: [{ $match: { kind: "order" } }, { $count: "count" }],
                    products: [
                        { $match: { kind: "page", productId: { $exists: true } } },
                        {
                            $group: {
                                _id: "$productId",
                                name: { $last: "$productName" },
                                views: { $sum: 1 },
                            },
                        },
                        { $sort: { views: -1, _id: 1 } },
                        { $limit: 20 },
                    ],
                    productViews: [
                        { $match: { kind: "page", productId: { $exists: true } } },
                        { $count: "count" },
                    ],
                },
            },
        ],
        cursor: {},
        maxTimeMS: 5000,
    })) as unknown as {
        cursor: {
            firstBatch: Array<{
                sessions: Array<{ visits: number; convertedVisits: number }>;
                pages: Array<{ count: number }>;
                orders: Array<{ count: number }>;
                productViews: Array<{ count: number }>;
                products: Array<{ _id: string; name: string; views: number }>;
            }>;
        };
    };
    const data = result.cursor.firstBatch[0];
    const visits = data?.sessions[0]?.visits ?? 0,
        convertedVisits = data?.sessions[0]?.convertedVisits ?? 0;
    const first = (await prisma.$runCommandRaw({
        find: collection,
        filter: { scope, test: false, kind: "page" },
        sort: { at: 1 },
        limit: 1,
        projection: { at: 1 },
        maxTimeMS: 1500,
    })) as unknown as { cursor: { firstBatch: Array<{ at: number }> } };
    return {
        days,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        trackingSince: first.cursor.firstBatch[0]?.at
            ? new Date(first.cursor.firstBatch[0].at).toISOString()
            : null,
        visits,
        convertedVisits,
        orderRate: visits ? Number(((convertedVisits / visits) * 100).toFixed(2)) : null,
        pageViews: data?.pages[0]?.count ?? 0,
        productViews: data?.productViews[0]?.count ?? 0,
        attributedOrders: data?.orders[0]?.count ?? 0,
        products: (data?.products ?? []).map((p) => ({ id: p._id, name: p.name, views: p.views })),
    };
}
