import { z } from "zod";
import { AppError } from "../middleware/error.middleware";

// Supported, pinned API. Only these two GET resources are reachable from this integration.
export const META_ADS_VERSION = "v26.0";
export const metaId = z.string().regex(/^[0-9]{5,25}$/);
export const metaAccountId = z
  .string()
  .trim()
  .transform((v) => v.replace(/^act_/, ""))
  .pipe(metaId);
export const mediaDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return (
      !v.startsWith("0000") && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v
    );
  }, "Date invalide");
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine((v) => {
    try {
      new Intl.NumberFormat("en", { style: "currency", currency: v });
      return true;
    } catch {
      return false;
    }
  });
const zone = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  });
export function mediaToday(timeZone: string, now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((type) => p.find((x) => x.type === type)!.value).join("-");
}
/** Use the same ICU calendar as the account's displayed dates, independent of PostgreSQL tzdata/session settings. */
export function mediaBoundary(day: string, timeZone: string, next = false) {
  mediaDay.parse(day);
  if (next) day = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
  let low = Date.parse(day) - 48 * 3600000,
    high = Date.parse(day) + 48 * 3600000;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2000) * 1000;
    if (mediaToday(timeZone, new Date(mid)) < day) low = mid;
    else high = mid;
  }
  return new Date(high);
}
export function mediaDays(from: string, to: string) {
  mediaDay.parse(from);
  mediaDay.parse(to);
  const count = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (count < 1 || count > 90) throw new AppError("Choisissez une période de 1 à 90 jours.", 400);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10),
  );
}
export const MAX_MEDIA_MICROS = 9_000_000_000_000_000_000n;
export function spendMicros(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,6})?$/.test(value))
    throw new AppError("Les dépenses renvoyées par Meta sont invalides.", 502);
  const [whole, fraction = ""] = value.split("."),
    result = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (result > MAX_MEDIA_MICROS)
    throw new AppError("Les dépenses renvoyées par Meta dépassent la limite de contrôle.", 502);
  return result;
}
export function mediaMoney(micros: bigint) {
  return `${micros / 1000000n}.${String(micros % 1000000n).padStart(6, "0")}`;
}
export function deliveredCost(micros: bigint, delivered: number) {
  return delivered > 0
    ? mediaMoney((micros + BigInt(Math.floor(delivered / 2))) / BigInt(delivered))
    : null;
}
export class MetaReadError extends AppError {
  constructor(kind: "token" | "permission" | "limit" | "network" | "format") {
    super(
      {
        token: "Le jeton Meta est expiré ou invalide. Reconnectez le compte.",
        permission:
          "Meta refuse cet accès. Vérifiez la permission ads_read et l’accès au compte publicitaire.",
        limit:
          "Meta limite temporairement les lectures. Réessayez plus tard avec une période plus courte.",
        network:
          "La lecture Meta est indisponible. Les dernières dépenses conservées restent inchangées.",
        format:
          "La réponse Meta est incomplète ou invalide. Les dépenses conservées restent inchangées.",
      }[kind],
      502,
    );
  }
}
async function graph(
  accountId: string,
  resource: "" | "/insights",
  token: string,
  parameters: Record<string, string>,
  deadline: number,
) {
  metaId.parse(accountId);
  const url = new URL(`https://graph.facebook.com/${META_ADS_VERSION}/act_${accountId}${resource}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new MetaReadError("limit");
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "error",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      signal: AbortSignal.timeout(Math.min(15000, remaining)),
    });
  } catch {
    throw new MetaReadError("network");
  }
  // Never expose Graph messages, URLs, headers or credentials in responses/logs.
  let body: any;
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new Error();
      }
      parts.push(value);
    }
    body = JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new MetaReadError("format");
  }
  if (!response.ok || body?.error) {
    const code = body?.error?.code;
    throw new MetaReadError(
      code === 190
        ? "token"
        : [10, 200, 294].includes(code)
          ? "permission"
          : [4, 17, 32, 613].includes(code) || response.status === 429
            ? "limit"
            : "network",
    );
  }
  return body;
}
export async function readMetaAccount(
  accountId: string,
  token: string,
  deadline = Date.now() + 30000,
) {
  const value = await graph(
    accountId,
    "",
    token,
    { fields: "id,account_id,name,currency,timezone_name" },
    deadline,
  );
  const result = z
    .object({
      id: z.literal("act_" + accountId),
      account_id: z.literal(accountId),
      name: z.string().min(1).max(255),
      currency,
      timezone_name: zone,
    })
    .safeParse(value);
  if (!result.success) throw new MetaReadError("format");
  return {
    accountId,
    accountName: result.data.name,
    currency: result.data.currency,
    timeZone: result.data.timezone_name,
  };
}
const fields =
  "account_id,account_currency,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,date_start,date_stop,spend";
export async function verifyMetaInsights(
  accountId: string,
  token: string,
  timeZone: string,
  deadline = Date.now() + 30000,
) {
  const today = mediaToday(timeZone),
    body = await graph(
      accountId,
      "/insights",
      token,
      {
        fields,
        level: "ad",
        time_increment: "1",
        time_range: JSON.stringify({ since: today, until: today }),
        limit: "1",
      },
      deadline,
    );
  if (!Array.isArray(body?.data)) throw new MetaReadError("format");
}
export type MetaSpendRow = {
  accountId: string;
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  date: string;
  spendMicros: bigint;
};
export async function readMetaSpend(
  accountId: string,
  token: string,
  from: string,
  to: string,
  accountCurrency: string,
  deadline = Date.now() + 75000,
) {
  const days = mediaDays(from, to),
    output: MetaSpendRow[] = [],
    seenRows = new Set<string>(),
    dimensions = new Map<string, string>();
  let total = 0n;
  for (let chunk = 0; chunk < days.length; chunk += 31) {
    const since = days[chunk],
      until = days[Math.min(chunk + 30, days.length - 1)];
    let after: string | undefined;
    const cursors = new Set<string>();
    for (let page = 0; ; page++) {
      if (page >= 100 || output.length > 10000) throw new MetaReadError("limit");
      const body = await graph(
        accountId,
        "/insights",
        token,
        {
          fields,
          level: "ad",
          time_increment: "1",
          time_range: JSON.stringify({ since, until }),
          limit: "500",
          ...(after ? { after } : {}),
        },
        deadline,
      );
      if (!Array.isArray(body?.data) || body.data.length > 500) throw new MetaReadError("format");
      for (const item of body.data) {
        const parsed = z
          .object({
            account_id: z.literal(accountId),
            account_currency: z.literal(accountCurrency),
            ad_id: metaId,
            ad_name: z.string().min(1).max(255),
            adset_id: metaId,
            adset_name: z.string().min(1).max(255),
            campaign_id: metaId,
            campaign_name: z.string().min(1).max(255),
            date_start: mediaDay,
            date_stop: mediaDay,
            spend: z.unknown(),
          })
          .safeParse(item);
        if (!parsed.success) throw new MetaReadError("format");
        const r = parsed.data;
        if (r.date_start !== r.date_stop || r.date_start < since || r.date_start > until)
          throw new MetaReadError("format");
        const key = r.ad_id + ":" + r.date_start,
          dimension = r.campaign_id + ":" + r.adset_id;
        if (seenRows.has(key) || (dimensions.has(r.ad_id) && dimensions.get(r.ad_id) !== dimension))
          throw new MetaReadError("format");
        seenRows.add(key);
        dimensions.set(r.ad_id, dimension);
        const amount = spendMicros(r.spend);
        total += amount;
        if (total > MAX_MEDIA_MICROS || output.length >= 10000 || dimensions.size > 1000)
          throw new MetaReadError("limit");
        output.push({
          accountId,
          adId: r.ad_id,
          adName: r.ad_name,
          adsetId: r.adset_id,
          adsetName: r.adset_name,
          campaignId: r.campaign_id,
          campaignName: r.campaign_name,
          date: r.date_start,
          spendMicros: amount,
        });
      }
      if (!body.paging?.next) break;
      const cursor = body.paging?.cursors?.after;
      if (
        typeof cursor !== "string" ||
        !/^[a-zA-Z0-9_=-]{1,4096}$/.test(cursor) ||
        cursors.has(cursor)
      )
        throw new MetaReadError("format");
      cursors.add(cursor);
      after = cursor;
      // Ignore the untrusted paging.next URL entirely; requests always use the fixed Graph origin.
    }
  }
  return output;
}
