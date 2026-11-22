import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/error.middleware";

export const CUSTOMER_HISTORY_PAGE_SIZE = 25;
/** Exact full-number matching only. A populated primary number is never replaced by another contact. */
export function customerPhoneRows(where: Prisma.Sql) {
    return Prisma.sql`SELECT n.*, CASE
        WHEN raw_phone !~ '^[+]?[0-9[:space:]().-]+$' THEN NULL
        WHEN digits ~ '^212[5-7][0-9]{8}$' THEN digits
        WHEN digits LIKE '212%' THEN NULL
        WHEN NOT international AND digits ~ '^0[5-7][0-9]{8}$' THEN '212' || substring(digits FROM 2)
        WHEN NOT international AND digits ~ '^[5-7][0-9]{8}$' THEN '212' || digits
        WHEN international AND digits ~ '^[1-9][0-9]{7,14}$' THEN digits
        ELSE NULL END AS phone_key
    FROM (SELECT r.*, raw_phone LIKE '+%' OR raw_phone LIKE '00%' AS international,
        regexp_replace(regexp_replace(raw_phone, '[^0-9]', '', 'g'), '^00', '') AS digits
        FROM (SELECT "id", "createdAt", "status", "deletedAt", "totalAmount", "paymentStatus",
            coalesce(nullif(regexp_replace(coalesce("customerPhone", ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
                regexp_replace(coalesce("phone", ''), '^[[:space:]]+|[[:space:]]+$', '', 'g')) AS raw_phone
            FROM "orders" WHERE ${where}) r) n`;
}

export async function customerHistorySummaries(tx: Prisma.TransactionClient, ids: string[]) {
    if (!ids.length) return new Map<string, { available: boolean; priorCancelledCount: number }>();
    const rows = await tx.$queryRaw<{ id: string; available: boolean; count: number }[]>(Prisma.sql`
        WITH anchors AS (${customerPhoneRows(Prisma.sql`"id" IN (${Prisma.join(ids)})`)}),
        cancelled AS (${customerPhoneRows(Prisma.sql`"status" = 'CANCELLED'`)})
        SELECT a.id, a.phone_key IS NOT NULL AS available, count(c.id)::int AS count
        FROM anchors a LEFT JOIN cancelled c ON c.phone_key = a.phone_key AND c."createdAt" < a."createdAt"
        GROUP BY a.id, a.phone_key`);
    return new Map(rows.map(row => [row.id, { available: row.available, priorCancelledCount: row.count }]));
}

type HistoryRow = { id: string; createdAt: Date; status: string; deletedAt: Date | null; totalAmount: number; paymentStatus: string };
export async function readCustomerOrderHistory(tx: Prisma.TransactionClient, orderId: string, requestedPage: number) {
    const anchors = await tx.$queryRaw<{ id: string; phone_key: string | null }[]>(Prisma.sql`
        SELECT id, phone_key FROM (${customerPhoneRows(Prisma.sql`"id" = ${orderId} AND "deletedAt" IS NULL`)}) a`);
    const anchor = anchors[0];
    if (!anchor) throw new AppError("Commande introuvable", 404);
    if (!anchor.phone_key) throw new AppError("Numéro complet indisponible pour cet historique", 422);
    const matched = Prisma.sql`phone_key = ${anchor.phone_key}`;
    const [counts] = await tx.$queryRaw<{ total: number; prior: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'CANCELLED'
            AND "createdAt" < (SELECT "createdAt" FROM "orders" WHERE id = ${orderId}))::int AS prior
        FROM (${customerPhoneRows(Prisma.sql`TRUE`)}) p WHERE ${matched}`);
    const totalPages = Math.ceil(counts.total / CUSTOMER_HISTORY_PAGE_SIZE);
    const page = Math.min(requestedPage, Math.max(1, totalPages));
    const rows = await tx.$queryRaw<HistoryRow[]>(Prisma.sql`
        SELECT id, "createdAt", status::text, "deletedAt", "totalAmount", "paymentStatus"::text
        FROM (${customerPhoneRows(Prisma.sql`TRUE`)}) p WHERE ${matched}
        ORDER BY "createdAt" DESC, id DESC LIMIT ${CUSTOMER_HISTORY_PAGE_SIZE} OFFSET ${(page - 1) * CUSTOMER_HISTORY_PAGE_SIZE}`);
    const cancelled = rows.filter(row => row.status === "CANCELLED").map(row => row.id);
    const dates = cancelled.length ? await tx.$queryRaw<{ orderId: string; cancelledAt: Date }[]>(Prisma.sql`
        SELECT "orderId", max("createdAt") AS "cancelledAt" FROM "order_events"
        WHERE "orderId" IN (${Prisma.join(cancelled)}) AND type = 'status_changed'
        AND message ~ '^Order marked as CANCELLED [(](admin|sheets|crm|olivraison)[)]$' GROUP BY "orderId"`) : [];
    const byId = new Map(dates.map(row => [row.orderId, row.cancelledAt]));
    return { anchorOrderId: orderId, phone: '+' + anchor.phone_key, priorCancelledCount: counts.prior,
        total: counts.total, page, totalPages, data: rows.map(row => ({ ...row, cancelledAt: byId.get(row.id) ?? null })) };
}
