/** URL-declared attribution, never proof of a Meta click or an ad's ownership. */
export const CAMPAIGN_NOTICE_VERSION = "campaign-order-v1";
export const CAMPAIGN_WINDOW_MS = 30 * 86400_000;
export const CAMPAIGN_ORDER_RETENTION_MS = 90 * 86400_000;
export const CAMPAIGN_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "campaign_id",
  "adset_id",
  "ad_id",
] as const;
export type CampaignField = (typeof CAMPAIGN_FIELDS)[number];
export type CampaignTags = Partial<Record<CampaignField, string>>;
export type CampaignAttribution = {
  version: 1;
  model: "last_tagged_touch_30d";
  tags: CampaignTags;
  capturedAt: number;
  consentAt: number;
  consentVersion: typeof CAMPAIGN_NOTICE_VERSION;
};
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
/** Drop unknown fields and unsafe values; never truncate identifiers or retain arbitrary URLs/PII. */
export function campaignTags(input: unknown): CampaignTags {
  const out: CampaignTags = {};
  if (!record(input)) return out;
  for (const key of CAMPAIGN_FIELDS) {
    const value = input[key];
    if (typeof value !== "string" || !value || value !== value.trim()) continue;
    const valid = /^(campaign_id|adset_id|ad_id)$/.test(key)
      ? /^[0-9]{5,25}$/.test(value)
      : value.length <= 100 && /^[\p{L}\p{N}_. -]+$/u.test(value);
    if (valid) out[key] = value;
  }
  return out;
}
export function campaignTagsFromSearch(search: string): CampaignTags {
  if (search.length > 8192) return {};
  const params = new URLSearchParams(search),
    values: Record<string, string> = {};
  for (const key of CAMPAIGN_FIELDS) {
    const all = params.getAll(key);
    if (all.length === 1) values[key] = all[0];
  }
  return campaignTags(values);
}
export function validCampaignAttribution(
  value: unknown,
  now = Date.now(),
): CampaignAttribution | null {
  if (
    !record(value) ||
    value.version !== 1 ||
    value.model !== "last_tagged_touch_30d" ||
    value.consentVersion !== CAMPAIGN_NOTICE_VERSION ||
    typeof value.capturedAt !== "number" ||
    !Number.isSafeInteger(value.capturedAt) ||
    typeof value.consentAt !== "number" ||
    !Number.isSafeInteger(value.consentAt) ||
    value.capturedAt > now ||
    now - value.capturedAt >= CAMPAIGN_WINDOW_MS ||
    value.consentAt > value.capturedAt ||
    now - value.consentAt >= 180 * 86400_000
  )
    return null;
  const tags = campaignTags(value.tags);
  return Object.keys(tags).length
    ? {
        version: 1,
        model: "last_tagged_touch_30d",
        tags,
        capturedAt: value.capturedAt,
        consentAt: value.consentAt,
        consentVersion: CAMPAIGN_NOTICE_VERSION,
      }
    : null;
}
