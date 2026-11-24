import { Prisma } from "@prisma/client";
import { z } from "zod";
import { customerPhoneRows } from "./customer-order-history";

export const DISPATCH_BLACKLIST_PAGE_SIZE = 25;
export const dispatchBlacklistQuery = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    search: z.string().trim().max(40).regex(/^[+0-9\s().-]*$/).default(""),
}).strict();

// The list is derived from retained cancelled orders, including the trash.
// It shares exact full-number identity with customer history, never suffix matching for dispatch.
export async function customerBlacklistSummaries(tx: Prisma.TransactionClient, ids: string[]) {
    if (!ids.length) return new Map<string, { available: boolean; blocked: boolean; cancelledCount: number }>();
    const rows = await tx.$queryRaw<{ id: string; available: boolean; count: number }[]>(Prisma.sql`
        WITH anchors AS (${customerPhoneRows(Prisma.sql`"id" IN (${Prisma.join(ids)})`)}),
        blocked AS (SELECT phone_key, count(*)::int AS count
            FROM (${customerPhoneRows(Prisma.sql`"status" = 'CANCELLED'`)}) c
            WHERE phone_key IS NOT NULL GROUP BY phone_key)
        SELECT a.id, a.phone_key IS NOT NULL AS available, coalesce(b.count, 0)::int AS count
        FROM anchors a LEFT JOIN blocked b ON b.phone_key = a.phone_key`);
    return new Map(rows.map(row => [row.id, {
        available: row.available, blocked: row.count > 0, cancelledCount: row.count,
    }]));
}

function searchDigits(value: string) {
    let digits = value.replace(/\D/g, "");
    if (value.trim().startsWith("00")) digits = digits.slice(2);
    if (/^0[5-7]\d{8}$/.test(digits)) return "212" + digits.slice(1);
    if (/^[5-7]\d{8}$/.test(digits) && !value.trim().startsWith("+")) return "212" + digits;
    return digits;
}

export async function readDispatchBlacklist(tx: Prisma.TransactionClient, input: z.infer<typeof dispatchBlacklistQuery>) {
    const digits = searchDigits(input.search);
    const filtered = Prisma.sql`phone_key IS NOT NULL ${digits ? Prisma.sql`AND position(${digits} IN phone_key) > 0` : Prisma.empty}`;
    const cte = Prisma.sql`WITH cancelled AS (${customerPhoneRows(Prisma.sql`"status" = 'CANCELLED'`)}),
        grouped AS (SELECT phone_key, count(*)::int AS "cancelledCount",
            count(*) FILTER (WHERE "deletedAt" IS NOT NULL)::int AS "trashCount",
            max("createdAt") AS "lastOrderCreatedAt",
            (array_agg(id ORDER BY "createdAt" DESC, id DESC))[1] AS "lastOrderId"
            FROM cancelled WHERE ${filtered} GROUP BY phone_key)`;
    const [count] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`${cte} SELECT count(*)::int AS total FROM grouped`);
    const totalPages = Math.ceil(count.total / DISPATCH_BLACKLIST_PAGE_SIZE);
    const page = Math.min(input.page, Math.max(1, totalPages));
    const rows = await tx.$queryRaw<{
        phone: string; cancelledCount: number; trashCount: number; lastOrderId: string; lastOrderCreatedAt: Date;
    }[]>(Prisma.sql`${cte} SELECT '+' || phone_key AS phone, "cancelledCount", "trashCount", "lastOrderId", "lastOrderCreatedAt"
        FROM grouped ORDER BY "cancelledCount" DESC, "lastOrderCreatedAt" DESC, phone_key ASC
        LIMIT ${DISPATCH_BLACKLIST_PAGE_SIZE} OFFSET ${(page - 1) * DISPATCH_BLACKLIST_PAGE_SIZE}`);
    return { data: rows, total: count.total, totalPages, page };
}
