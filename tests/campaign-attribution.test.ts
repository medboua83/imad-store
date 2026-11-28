import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMPAIGN_NOTICE_VERSION,
  CAMPAIGN_WINDOW_MS,
  campaignTagsFromSearch,
  validCampaignAttribution,
} from "../packages/shared/src/campaign-attribution";
import {
  captureCampaign,
  chooseCampaignConsent,
  campaignChoiceNeeded,
} from "../apps/web/src/lib/campaign-attribution";
test("Only allowlisted bounded campaign labels and string Meta IDs survive untrusted URLs", () => {
  assert.deepEqual(
    campaignTagsFromSearch(
      "?utm_source=facebook&utm_medium=paid_social&campaign_id=12345678901234567890&adset_id=12345&ad_id=99999&email=person%40invalid.test&fbclid=private&access_token=secret",
    ),
    {
      utm_source: "facebook",
      utm_medium: "paid_social",
      campaign_id: "12345678901234567890",
      adset_id: "12345",
      ad_id: "99999",
    },
  );
  for (const value of [
    "a@invalid.test",
    "https://example.test",
    "=1+1",
    "<script>",
    "a\n",
    "x".repeat(101),
    "{{campaign.name}}",
  ])
    assert.deepEqual(campaignTagsFromSearch("?utm_campaign=" + encodeURIComponent(value)), {});
  assert.deepEqual(
    campaignTagsFromSearch(
      "?utm_source=a&utm_source=b&ad_id=123&adset_id=1e123&campaign_id=%7B%7Bcampaign.id%7D%7D",
    ),
    {},
  );
  const now = Date.now(),
    touch = {
      version: 1,
      model: "last_tagged_touch_30d",
      tags: { ad_id: "12345" },
      capturedAt: now,
      consentAt: now,
      consentVersion: CAMPAIGN_NOTICE_VERSION,
    };
  assert.ok(validCampaignAttribution(touch, now));
  for (const patch of [
    { capturedAt: now + 1 },
    { capturedAt: now - CAMPAIGN_WINDOW_MS },
    { consentAt: now + 1 },
    { consentVersion: "old" },
    { tags: { ad_id: 12345 } },
    { version: 2 },
  ])
    assert.equal(validCampaignAttribution({ ...touch, ...patch }, now), null);
});
test("Consent precedes storage; last tagged touch survives navigation, refusal, expiry and blocked storage are safe", () => {
  const data = new Map<string, string>(),
    location = {
      protocol: "https:",
      hostname: "shop.invalid",
      pathname: "/",
      search: "?utm_source=facebook&campaign_id=12345&ad_id=99999",
    };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location } });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { doNotTrack: "0", globalPrivacyControl: false },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) || null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
  });
  assert.equal(campaignChoiceNeeded(), true);
  assert.equal(captureCampaign(), null);
  assert.equal(data.size, 0);
  chooseCampaignConsent(true);
  const first = captureCampaign()!;
  assert.equal(first.tags.ad_id, "99999");
  assert.equal(campaignChoiceNeeded(), false);
  location.pathname = "/checkout";
  location.search = "";
  assert.deepEqual(captureCampaign(), first);
  location.search = "?utm_campaign=next&campaign_id=88888";
  const second = captureCampaign()!;
  assert.equal(second.tags.campaign_id, "88888");
  assert.equal(second.tags.ad_id, undefined, "no mixing between campaigns");
  location.search = "";
  data.set(
    "imad:campaign-touch:v1",
    JSON.stringify({ ...second, capturedAt: Date.now() - CAMPAIGN_WINDOW_MS }),
  );
  assert.equal(captureCampaign(), null);
  assert.equal(data.has("imad:campaign-touch:v1"), false);
  location.search = "?ad_id=12345";
  chooseCampaignConsent(false);
  assert.equal(captureCampaign(), null);
  chooseCampaignConsent(true);
  assert.ok(captureCampaign());
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { globalPrivacyControl: true },
  });
  assert.equal(captureCampaign(), null);
  assert.equal(data.has("imad:campaign-touch:v1"), false);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { doNotTrack: "0" },
  });
  data.set("adminToken", "fixture");
  assert.equal(captureCampaign(), null);
  data.delete("adminToken");
  location.search = "?stats_test=1&ad_id=12345";
  assert.equal(captureCampaign(), null);
  location.search = "?ad_id=12345";
  chooseCampaignConsent(true);
  assert.ok(captureCampaign());
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) || null,
      setItem: () => { throw Error("read only"); }, removeItem: () => { throw Error("read only"); } },
  });
  chooseCampaignConsent(false);
  assert.equal(captureCampaign(), null, "withdrawal still blocks transmission if persisted consent cannot be overwritten");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => {
        throw Error("blocked");
      },
      removeItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    },
  });
  assert.doesNotThrow(() => chooseCampaignConsent(true));
  assert.equal(captureCampaign(), null);
});

test("The documented Meta template matches the exact implemented keys after dynamic substitution", () => {
  const doc = readFileSync(join(__dirname, "../docs/CAMPAIGN_ATTRIBUTION.md"), "utf8");
  const template = doc.match(/```\n([^\n]+)\n```/)![1];
  const url = template.replaceAll("{{campaign.id}}", "12345678901234567890")
    .replaceAll("{{adset.id}}", "23456789012345678901")
    .replaceAll("{{ad.id}}", "34567890123456789012");
  assert.deepEqual(campaignTagsFromSearch(url), { utm_source:"meta", utm_medium:"paid_social", utm_campaign:"12345678901234567890", utm_content:"34567890123456789012", campaign_id:"12345678901234567890", adset_id:"23456789012345678901", ad_id:"34567890123456789012" });
  assert.ok(!template.startsWith("?"));
});
