/** IDs stay strings. URL parameters are declarative attribution, not a verified Meta conversion. */
export const META_URL_PARAMETERS =
  "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";
export type MediaCounts = {
  attributed: number;
  confirmed: number;
  delivered: number;
  cancelled: number;
  returned: number;
  returning: number;
  inDelivery: number;
  awaiting: number;
  review: number;
  mature: number;
};
export const emptyMediaCounts = (): MediaCounts => ({
  attributed: 0,
  confirmed: 0,
  delivered: 0,
  cancelled: 0,
  returned: 0,
  returning: 0,
  inDelivery: 0,
  awaiting: 0,
  review: 0,
  mature: 0,
});
export type MediaRow = MediaCounts & {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  spend: string | null;
  costPerDelivered: string | null;
};
export type MediaConnection = {
  revision: number;
  connected: boolean;
  accountId: string | null;
  accountName: string | null;
  currency: string | null;
  timeZone: string;
  today: string;
  targetCents: number | null;
  lastSyncAt: string | null;
  lastError: string | null;
  syncing: boolean;
  mfaEnabled: boolean;
  canManage: boolean;
};
export type MediaRecommendation = {
  campaignId: string;
  campaignName: string;
  action: "sync" | "target" | "currency" | "review" | "test" | "cost" | "scale";
  reasons: string[];
  counts: MediaCounts;
  spend: string | null;
  costPerDelivered: string | null;
};
export type MediaReport = {
  from: string;
  to: string;
  timeZone: string;
  currency: string | null;
  accountId: string | null;
  checkedAt: string;
  targetCents: number | null;
  coverage: { complete: boolean; missingDays: number; oldestSyncAt: string | null };
  unknown: MediaCounts;
  unknownWithAdId: number;
  totals: MediaCounts & { spend: string | null; costPerDelivered: string | null };
  ads: MediaRow[];
  recommendations: MediaRecommendation[];
  choices: Array<{
    campaignId: string;
    campaignName: string;
    adsetId: string;
    adsetName: string;
    adId: string;
    adName: string;
  }>;
  collectedRevenue: null;
};
