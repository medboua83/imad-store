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

const moroccoOffset = new Intl.DateTimeFormat("en", { timeZone: "Africa/Casablanca", timeZoneName: "longOffset" });
/** UTC boundary for the same Moroccan calendar used by the interface, independent of PostgreSQL tzdata. */
export function moroccoDayBoundary(day: string, followingDay = false) {
    const target = new Date(day + "T00:00:00Z");
    if (followingDay) target.setUTCDate(target.getUTCDate() + 1);
    let instant = target.getTime();
    for (let attempt = 0; attempt < 5; attempt++) {
        const zone = moroccoOffset.formatToParts(new Date(instant)).find(part => part.type === "timeZoneName")?.value ?? "";
        const match = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(zone);
        if (!match) throw new Error("Moroccan calendar offset unavailable");
        const seconds = (Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0)) * (match[1] === "-" ? -1 : 1);
        const next = target.getTime() - seconds * 1000;
        if (next === instant)
            return new Date(instant).toISOString().replace(/^\+0/, "").replace("T", " ").replace(/Z$/, "");
        instant = next;
    }
    throw new Error("Moroccan calendar boundary unavailable");
}

export function orderHistoryWhere(q: z.infer<typeof orderHistoryQuery>) {
    const parts: Prisma.Sql[] = [q.trash === "true" ? Prisma.sql`"deletedAt" IS NOT NULL` : Prisma.sql`"deletedAt" IS NULL`];
    if (q.payment) parts.push(Prisma.sql`"paymentStatus"::text = ${q.payment}`);
    if (q.from) parts.push(Prisma.sql`"createdAt" >= ${moroccoDayBoundary(q.from)}::timestamp`);
    if (q.to) parts.push(Prisma.sql`"createdAt" < ${moroccoDayBoundary(q.to, true)}::timestamp`);
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
