import { orderSearchReference, orderSearchPhone } from "@imad-store/shared";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { paginationSchema, statusSchema } from "./validation";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(value + "T00:00:00Z");
    return !value.startsWith("0000") && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date invalide");
export const orderHistoryQuery = paginationSchema.extend({
    search: z.string().trim().max(120).default(""),
    status: statusSchema.optional(),
    payment: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
    from: day.optional(),
    to: day.optional(),
    sort: z.enum(["newest", "oldest", "amount"]).default("newest"),
    trash: z.enum(["true", "false"]).default("false"),
}).refine(q => !q.from || !q.to || q.from <= q.to, "Période invalide");

export function orderHistoryWhere(q: z.infer<typeof orderHistoryQuery>) {
    const parts: Prisma.Sql[] = [q.trash === "true" ? Prisma.sql`"deletedAt" IS NOT NULL` : Prisma.sql`"deletedAt" IS NULL`];
    if (q.payment) parts.push(Prisma.sql`"paymentStatus"::text = ${q.payment}`);
    if (q.from) parts.push(Prisma.sql`"createdAt" >= (${q.from}::date::timestamp AT TIME ZONE 'Africa/Casablanca' AT TIME ZONE 'UTC')`);
    if (q.to) parts.push(Prisma.sql`"createdAt" < ((${q.to}::date + INTERVAL '1 day') AT TIME ZONE 'Africa/Casablanca' AT TIME ZONE 'UTC')`);
    if (q.search) {
        const reference = orderSearchReference(q.search);
        const phone = orderSearchPhone(q.search);
        const phoneMatch = phone.length >= 3 ? Prisma.sql`OR strpos(regexp_replace(coalesce("customerPhone", ''), '[^0-9]', '', 'g'), ${phone}) > 0 OR strpos(regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g'), ${phone}) > 0` : Prisma.empty;
        // All values are bound; %, underscores and SQL-like text are literal searches.
        parts.push(Prisma.sql`(
            strpos(lower("id"), lower(${reference})) > 0
            OR strpos(lower(coalesce("customerName", '')), lower(${q.search})) > 0
            OR strpos(lower(coalesce("fullName", '')), lower(${q.search})) > 0
            OR strpos(lower(coalesce("city", '')), lower(${q.search})) > 0
            ${phoneMatch}
        )`);
    }
    return Prisma.join(parts, " AND ");
}
export function orderHistorySort(sort: string) {
    return sort === "oldest" ? Prisma.sql`"createdAt" ASC, "id" ASC`
        : sort === "amount" ? Prisma.sql`"totalAmount" DESC, "createdAt" DESC, "id" DESC`
        : Prisma.sql`"createdAt" DESC, "id" DESC`;
}
