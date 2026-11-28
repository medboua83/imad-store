import {
  CAMPAIGN_NOTICE_VERSION,
  campaignTagsFromSearch,
  validCampaignAttribution,
  type CampaignAttribution,
} from "@imad-store/shared";
const consentKey = "imad:campaign-consent:v1";
const touchKey = "imad:campaign-touch:v1";
const consentRetention = 180 * 86400_000;
let deniedInDocument = false;
export function campaignAllowed() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.location.protocol === "https:" &&
      !/^(localhost|127\.|\[?::1\]?)/.test(window.location.hostname) &&
      !/^\/(admin|auth)(\/|$)/.test(window.location.pathname) &&
      !new URLSearchParams(window.location.search).has("stats_test") &&
      navigator.doNotTrack !== "1" &&
      !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl &&
      !localStorage.getItem("adminToken") &&
      !localStorage.getItem("imad:admin:profile")
    );
  } catch {
    return false;
  }
}
export function campaignConsent(): { allowed: boolean; at: number } | null {
  if (deniedInDocument) return { allowed: false, at: Date.now() };
  try {
    const raw = localStorage.getItem(consentKey),
      saved = raw ? JSON.parse(raw) : null;
    if (
      saved &&
      saved.version === CAMPAIGN_NOTICE_VERSION &&
      typeof saved.allowed === "boolean" &&
      Number.isSafeInteger(saved.at) &&
      saved.at <= Date.now() &&
      Date.now() - saved.at < consentRetention
    )
      return saved;
  } catch {
    /* Storage is optional. */
  }
  return null;
}
export function chooseCampaignConsent(allowed: boolean) {
  // Refusal must stop this document even if browser storage becomes read-only.
  deniedInDocument = !allowed;
  try {
    localStorage.removeItem(touchKey);
    localStorage.setItem(
      consentKey,
      JSON.stringify({ allowed, at: Date.now(), version: CAMPAIGN_NOTICE_VERSION }),
    );
    if (allowed) captureCampaign();
  } catch {
    /* No attribution if storage is blocked. */
  }
}
/** A direct visit preserves the last tagged touch, without extending its expiry. */
export function captureCampaign(): CampaignAttribution | null {
  try {
    const consent = campaignConsent();
    if (!campaignAllowed() || !consent?.allowed) {
      localStorage.removeItem(touchKey);
      return null;
    }
    const tags = campaignTagsFromSearch(window.location.search);
    if (Object.keys(tags).length) {
      const touch: CampaignAttribution = {
        version: 1,
        model: "last_tagged_touch_30d",
        tags,
        capturedAt: Date.now(),
        consentAt: consent.at,
        consentVersion: CAMPAIGN_NOTICE_VERSION,
      };
      // Re-reading the same landing must not extend the click window.
      const raw = localStorage.getItem(touchKey),
        old = raw ? validCampaignAttribution(JSON.parse(raw)) : null;
      if (!old || JSON.stringify(old.tags) !== JSON.stringify(tags))
        localStorage.setItem(touchKey, JSON.stringify(touch));
    }
    const raw = localStorage.getItem(touchKey),
      saved = raw ? validCampaignAttribution(JSON.parse(raw)) : null;
    if (!saved || saved.consentAt !== consent.at) {
      localStorage.removeItem(touchKey);
      return null;
    }
    return saved;
  } catch {
    try {
      localStorage.removeItem(touchKey);
    } catch {
      /* Optional storage. */
    }
    return null;
  }
}
export function campaignChoiceNeeded() {
  return (
    campaignAllowed() &&
    !campaignConsent() &&
    Object.keys(campaignTagsFromSearch(window.location.search)).length > 0
  );
}
