import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  emptyMediaCounts,
  olivraisonStatusLabels,
  type MediaCounts,
  type MediaReport,
  type MediaRow,
  type MediaRecommendation,
} from "@imad-store/shared";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";
import {
  mediaDay,
  mediaDays,
  mediaToday,
  mediaBoundary,
  metaId,
  mediaMoney,
  deliveredCost,
} from "./meta-ads";

export const mediaReportQuery = z
  .object({
    from: mediaDay,
    to: mediaDay,
    campaignId: metaId.optional(),
    adsetId: metaId.optional(),
    adId: metaId.optional(),
  })
  .strict();
type Query = z.infer<typeof mediaReportQuery>;
type Counts = MediaCounts & { adId: string | null; withAdId: number };
const countKeys = Object.keys(emptyMediaCounts()) as (keyof MediaCounts)[];
function addCounts(target: MediaCounts, source: MediaCounts) {
  for (const key of countKeys) target[key] += source[key];
}
const cancelled = ["CANCELED", "CANCELLED", "CUSTOMER_CANCELED", "DELETED"];
const shipping = [
  "PICKEDUP",
  "PICKED_UP",
  "INHOUSE",
  "RECIVED",
  "ENROUTE",
  "ASSIGN",
  "TRANSIT",
  "SCHEDULED",
  "REPORTED",
  "UNKNOWN_CALL",
];
const known = [...Object.keys(olivraisonStatusLabels), "RETURN_IN_TRANSIT", "RETURNING"];
const confirmationEvents = ["CONFIRMED", "SHIPPED", "DELIVERED"].flatMap((s) =>
  ["admin", "sheets", "crm", "olivraison"].map((origin) => `Order marked as ${s} (${origin})`),
);

export function mediaRecommendation(input: {
  campaignId: string;
  campaignName: string;
  counts: MediaCounts;
  micros: bigint;
  complete: boolean;
  currency: string | null;
  targetCents: number | null;
  connected: boolean;
  fresh: boolean;
  unknown: number;
  allOrders: number;
}): MediaRecommendation {
  const { counts: c, micros, targetCents } = input;
  const reasons: string[] = [],
    pending = c.inDelivery + c.awaiting + c.returning + c.review;
  let action: MediaRecommendation["action"] = "test";
  if (!input.connected || !input.complete || !input.fresh) {
    action = "sync";
    reasons.push(!input.connected ? "connect" : !input.complete ? "missing_spend" : "stale_sync");
  } else if (!targetCents) {
    action = "target";
    reasons.push("target_missing");
  } else if (input.currency !== "MAD") {
    action = "currency";
    reasons.push("currency_mismatch");
  } else if (c.review > 0 || input.unknown * 5 > input.allOrders) {
    action = "review";
    reasons.push(c.review ? "tracking_review" : "unknown_sources");
  } else if (c.cancelled + c.returned >= 5 && (c.cancelled + c.returned) * 4 >= c.attributed) {
    action = "review";
    reasons.push("returns_high");
  } else if (!c.attributed || micros === 0n) reasons.push("no_spend");
  else if (pending * 5 > c.attributed || c.mature * 10 < c.attributed * 7)
    reasons.push("pending_orders");
  else if (
    c.delivered >= 10 &&
    c.attributed >= 20 &&
    micros * 10n <= BigInt(targetCents) * 10000n * BigInt(c.delivered) * 8n
  ) {
    action = "scale";
    reasons.push("cost_below_target");
  } else if (
    c.delivered >= 5 &&
    micros * 4n > BigInt(targetCents) * 10000n * BigInt(c.delivered) * 5n
  ) {
    action = "cost";
    reasons.push("cost_high");
  } else reasons.push(c.delivered < 10 || c.attributed < 20 ? "few_deliveries" : "continue_test");
  return {
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    action,
    reasons,
    counts: c,
    spend: input.complete ? mediaMoney(micros) : null,
    costPerDelivered: input.complete ? deliveredCost(micros, c.delivered) : null,
  };
}

/** SQL aggregation never fetches a customer's name, phone, address or payment details. */
export async function mediaReport(raw: unknown, now = new Date()): Promise<MediaReport> {
  const utcSql = (date: Date) => date.toISOString().replace("T", " ").replace("Z", "");
  const nowSql = utcSql(now),
    matureSql = utcSql(new Date(now.getTime() - 7 * 86400000));
  const q = mediaReportQuery.parse(raw),
    days = mediaDays(q.from, q.to);
  return prisma.$transaction(
    async (tx) => {
      const cfg = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
      const accountId = cfg?.accountId ?? null,
        timeZone = cfg?.timeZone ?? "Africa/Casablanca",
        currency = cfg?.currency ?? null;
      if (q.to > mediaToday(timeZone, now))
        throw new AppError("La période ne peut pas se terminer dans le futur.", 400);
      const bounds = {
        start: mediaBoundary(q.from, timeZone),
        end: mediaBoundary(q.to, timeZone, true),
      };
      const ads = accountId
        ? await tx.metaAd.findMany({
            where: { accountId },
            orderBy: [{ campaignId: "asc" }, { adsetId: "asc" }, { adId: "asc" }],
            take: 10001,
          })
        : [];
      if (ads.length > 10000)
        throw new AppError(
          "Le compte contient trop de publicités pour ce rapport. Contactez l’administrateur.",
          422,
        );
      const byId = new Map(ads.map((a) => [a.adId, a]));
      // Full account coverage is recorded only after every Insights page has been validated and committed.
      const coverageRows = accountId
        ? await tx.metaSyncDay.findMany({
            where: {
              accountId,
              date: { gte: new Date(q.from), lte: new Date(q.to) },
              currency: currency!,
              timeZone,
            },
          })
        : [];
      const complete = !!accountId && coverageRows.length === days.length;
      const oldest = coverageRows.length
        ? new Date(Math.min(...coverageRows.map((r) => r.syncedAt.getTime())))
        : null;
      const spendRows = accountId
        ? await tx.metaDailySpend.groupBy({
            by: ["adId"],
            where: {
              accountId,
              currency: currency!,
              timeZone,
              date: { gte: new Date(q.from), lte: new Date(q.to) },
            },
            _sum: { spendMicros: true },
          })
        : [];
      const spends = new Map(spendRows.map((r) => [r.adId, r._sum.spendMicros ?? 0n]));
      const aggregates = await tx.$queryRaw<Counts[]>(Prisma.sql`
            WITH cohort AS (
                SELECT a."adId", o."createdAt", o."status", o."confirmedAt", o."confirmationMethod", s."carrierStatus",
                    (o."campaignAttributionExpiresAt" > ${nowSql}::timestamp AND o."campaignAttribution"->'tags'->>'ad_id' IS NOT NULL) AS tagged,
                    EXISTS (SELECT 1 FROM "order_events" e WHERE e."orderId"=o."id" AND e."type"='status_changed' AND e."message" IN (${Prisma.join(confirmationEvents)})) AS confirmed_event
                FROM "orders" o LEFT JOIN "olivraison_shipments" s ON s."id"=o."id"
                LEFT JOIN "meta_ads" a ON a."accountId"=${accountId ?? ""}
                    AND o."campaignAttributionExpiresAt" > ${nowSql}::timestamp
                    AND o."campaignAttribution"->>'version'='1'
                    AND o."campaignAttribution"->>'model'='last_tagged_touch_30d'
                    AND o."campaignAttribution"->>'consentVersion'='campaign-order-v1'
                    AND a."adId"=o."campaignAttribution"->'tags'->>'ad_id'
                    AND a."campaignId"=o."campaignAttribution"->'tags'->>'campaign_id'
                    AND a."adsetId"=o."campaignAttribution"->'tags'->>'adset_id'
                WHERE o."createdAt" >= ${utcSql(bounds.start)}::timestamp AND o."createdAt" < ${utcSql(bounds.end)}::timestamp
            ), outcomes AS (
                SELECT *, CASE
                    WHEN "carrierStatus"='RETURNED' THEN 'returned'
                    WHEN "carrierStatus" IN ('RETURN_IN_TRANSIT','RETURNING') THEN 'returning'
                    WHEN "carrierStatus"='DELIVERED' THEN 'delivered'
                    WHEN "carrierStatus"='ARCHIVED' THEN 'review'
                    WHEN ("status"='DELIVERED' AND "carrierStatus" IN (${Prisma.join(cancelled)}))
                        OR (coalesce("carrierStatus",'')<>'' AND "carrierStatus" NOT IN (${Prisma.join(known)})) THEN 'review'
                    WHEN "status"='DELIVERED' THEN 'delivered'
                    WHEN "status"='CANCELLED' OR "carrierStatus" IN (${Prisma.join(cancelled)}) THEN 'cancelled'
                    WHEN "status"='SHIPPED' OR "carrierStatus" IN (${Prisma.join(shipping)}) THEN 'inDelivery'
                    ELSE 'awaiting' END AS outcome
                FROM cohort
            )
            SELECT "adId", count(*)::int AS attributed,
                count(*) FILTER (WHERE "confirmedAt" IS NOT NULL OR "confirmationMethod"='SITE' OR "status" IN ('CONFIRMED','SHIPPED','DELIVERED') OR confirmed_event)::int AS confirmed,
                count(*) FILTER (WHERE outcome='delivered')::int AS delivered,
                count(*) FILTER (WHERE outcome='cancelled')::int AS cancelled,
                count(*) FILTER (WHERE outcome='returned')::int AS returned,
                count(*) FILTER (WHERE outcome='returning')::int AS returning,
                count(*) FILTER (WHERE outcome='inDelivery')::int AS "inDelivery",
                count(*) FILTER (WHERE outcome='awaiting')::int AS awaiting,
                count(*) FILTER (WHERE outcome='review')::int AS review,
                count(*) FILTER (WHERE "createdAt"<=${matureSql}::timestamp)::int AS mature,
                count(*) FILTER (WHERE tagged)::int AS "withAdId"
            FROM outcomes GROUP BY "adId"`);
      const unknown = emptyMediaCounts(),
        counts = new Map<string, MediaCounts>();
      let unknownWithAdId = 0;
      for (const r of aggregates) {
        const value = Object.fromEntries(countKeys.map((key) => [key, r[key]])) as MediaCounts;
        if (r.adId === null) {
          addCounts(unknown, value);
          unknownWithAdId = r.withAdId;
        } else counts.set(r.adId, value);
      }
      const selected = (a: (typeof ads)[number]) =>
        (!q.campaignId || a.campaignId === q.campaignId) &&
        (!q.adsetId || a.adsetId === q.adsetId) &&
        (!q.adId || a.adId === q.adId);
      for (const id of [q.adId].filter(Boolean) as string[])
        if (!byId.has(id))
          throw new AppError("Cette publicité n’est pas connue dans le compte sélectionné.", 400);
      if (
        (q.campaignId && !ads.some((a) => a.campaignId === q.campaignId)) ||
        (q.adsetId &&
          !ads.some(
            (a) => a.adsetId === q.adsetId && (!q.campaignId || a.campaignId === q.campaignId),
          ))
      )
        throw new AppError(
          "Les filtres publicitaires ne correspondent pas au compte sélectionné.",
          400,
        );
      if (q.adId && !selected(byId.get(q.adId)!))
        throw new AppError(
          "Les filtres publicitaires ne correspondent pas au compte sélectionné.",
          400,
        );
      const totals = emptyMediaCounts(),
        allCounts = emptyMediaCounts();
      let totalMicros = 0n;
      const rows: MediaRow[] = [],
        campaigns = new Map<string, { name: string; counts: MediaCounts; micros: bigint }>();
      for (const a of ads) {
        const c = counts.get(a.adId) ?? emptyMediaCounts(),
          micros = spends.get(a.adId) ?? 0n;
        addCounts(allCounts, c);
        if (!q.campaignId || a.campaignId === q.campaignId) {
          const campaign = campaigns.get(a.campaignId) ?? {
            name: a.campaignName,
            counts: emptyMediaCounts(),
            micros: 0n,
          };
          addCounts(campaign.counts, c);
          campaign.micros += micros;
          campaigns.set(a.campaignId, campaign);
        }
        if (!selected(a) || (!c.attributed && !spends.has(a.adId))) continue;
        addCounts(totals, c);
        totalMicros += micros;
        rows.push({
          ...c,
          adId: a.adId,
          adName: a.adName,
          adsetId: a.adsetId,
          adsetName: a.adsetName,
          campaignId: a.campaignId,
          campaignName: a.campaignName,
          spend: complete ? mediaMoney(micros) : null,
          costPerDelivered: complete ? deliveredCost(micros, c.delivered) : null,
        });
      }
      rows.sort(
        (a, b) =>
          Number(b.spend ?? 0) - Number(a.spend ?? 0) ||
          b.attributed - a.attributed ||
          a.adId.localeCompare(b.adId),
      );
      const fresh = !!oldest && now.getTime() - oldest.getTime() <= 48 * 3600000 && !cfg?.lastError;
      return {
        from: q.from,
        to: q.to,
        timeZone,
        currency,
        accountId,
        checkedAt: now.toISOString(),
        targetCents: cfg?.targetCents ?? null,
        coverage: {
          complete,
          missingDays: days.length - coverageRows.length,
          oldestSyncAt: oldest?.toISOString() ?? null,
        },
        unknown,
        unknownWithAdId,
        totals: {
          ...totals,
          spend: complete ? mediaMoney(totalMicros) : null,
          costPerDelivered: complete ? deliveredCost(totalMicros, totals.delivered) : null,
        },
        ads: rows,
        choices: ads.map((a) => ({
          campaignId: a.campaignId,
          campaignName: a.campaignName,
          adsetId: a.adsetId,
          adsetName: a.adsetName,
          adId: a.adId,
          adName: a.adName,
        })),
        recommendations: [...campaigns]
          .filter(([, c]) => c.counts.attributed || c.micros)
          .map(([id, c]) =>
            mediaRecommendation({
              campaignId: id,
              campaignName: c.name,
              counts: c.counts,
              micros: c.micros,
              complete,
              currency,
              targetCents: cfg?.targetCents ?? null,
              connected: !!cfg?.tokenCiphertext,
              fresh,
              unknown: unknown.attributed,
              allOrders: allCounts.attributed + unknown.attributed,
            }),
          ),
        collectedRevenue: null,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 20000 },
  );
}
