import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import request from "supertest";
import { emptyMediaCounts, type CampaignAttribution } from "@imad-store/shared";
import {
  mediaBoundary,
  mediaToday,
  mediaDays,
  spendMicros,
  deliveredCost,
  readMetaSpend,
} from "../backend/src/lib/meta-ads";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const database = "imad_ci_" + randomBytes(8).toString("hex");
Object.assign(process.env, {
  DATABASE_URL: databaseUrl(database) + "?connection_limit=1",
  DESKCOMM_OUTBOX_WORKER_ENABLED: "false",
  JWT_SECRET: "media-fixture-jwt",
  JWT_REFRESH_SECRET: "media-fixture-refresh",
  DESKCOMM_ENCRYPTION_KEY: "ab".repeat(32),
  INTEGRATION_TEST_MODE: "true",
  SITE_URL: "https://media.example.invalid",
});
const uid = "a".repeat(24),
  staffId = "b".repeat(24),
  readerId = "c".repeat(24),
  pwd = "Media-Fixture-Only-2026",
  token = "Meta-fixture-token-never-real-2026",
  accountId = "12345678901234567890";
const campaignId = "23456789012345678901",
  adsetId = "34567890123456789012",
  adId = "45678901234567890123",
  secondAd = "45678901234567890124";
const from = "2026-11-20",
  to = from,
  now = new Date("2026-11-28T12:00:00Z");
let p: any,
  app: any,
  lib: typeof import("../backend/src/lib/media-buyer-connection"),
  report: typeof import("../backend/src/lib/media-buyer-report");
const actor = {
  id: uid,
  email: "owner@example.invalid",
  role: "ADMIN",
  permissions: [],
  authVersion: 0,
};
let currency = "MAD",
  timeZone = "Africa/Casablanca",
  graphError = 0,
  spend = "100.50",
  duplicate = false,
  paged = false,
  names = "Original",
  delay: null | (() => Promise<void>) = null,
  calls: { url: URL; method: string; auth: string | undefined }[] = [];
const originalFetch = globalThis.fetch;
const adRow = (date: string, id = adId) => ({
  account_id: accountId,
  account_currency: currency,
  ad_id: id,
  ad_name: names + " annonce",
  adset_id: adsetId,
  adset_name: names + " ensemble",
  campaign_id: campaignId,
  campaign_name: names + " campagne",
  date_start: date,
  date_stop: date,
  spend,
});
const header = (id = uid, role = "ADMIN") => ({
  Authorization: "Bearer " + jwt.sign({ id, role }, process.env.JWT_SECRET!),
});
const api = (method: "get" | "post" | "put", path: string, h = header()) =>
  request(app)
    [method]("/api/media-buyer/" + path)
    .set(h);
const touch = (): CampaignAttribution => ({
  version: 1,
  model: "last_tagged_touch_30d",
  tags: { utm_source: "meta", campaign_id: campaignId, adset_id: adsetId, ad_id: adId },
  capturedAt: now.getTime() - 864000000,
  consentAt: now.getTime() - 864000000,
  consentVersion: "campaign-order-v1",
});
const commerce = async () =>
  JSON.stringify({
    orders: await p.order.findMany({ orderBy: { id: "asc" } }),
    stock: await p.productVariant.findMany(),
    parcels: await p.olivraisonShipment.findMany({ orderBy: { id: "asc" } }),
    events: await p.orderEvent.findMany({ orderBy: { id: "asc" } }),
  });
const cfg = () => p.mediaBuyerConnection.findUniqueOrThrow({ where: { id: "meta" } });
const sync = async (extra = {}) =>
  lib.syncMetaSpend(actor, { from, to, revision: (await cfg()).revision, ...extra });
const getReport = (extra = {}) => report.mediaReport({ from, to, ...extra }, now);
before(async () => {
  await createDatabase(database);
  ({ prisma: p } = await import("../backend/src/lib/prisma"));
  ({ app } = await import("../backend/src/app"));
  lib = await import("../backend/src/lib/media-buyer-connection");
  report = await import("../backend/src/lib/media-buyer-report");
  await p.user.createMany({
    data: [
      {
        id: uid,
        email: actor.email,
        passwordHash: await bcrypt.hash(pwd, 4),
        firstName: "Fictif",
        lastName: "Owner",
        role: "ADMIN",
      },
      {
        id: staffId,
        email: "staff@example.invalid",
        passwordHash: "fixture-no-login",
        firstName: "Fictif",
        lastName: "Staff",
        role: "STAFF",
        permissions: ["analytics.read"],
      },
      {
        id: readerId,
        email: "reader@example.invalid",
        passwordHash: "fixture-no-login",
        firstName: "Fictif",
        lastName: "Reader",
        role: "STAFF",
        permissions: ["media.read"],
      },
    ],
  });
  globalThis.fetch = (async (input: any, options: any) => {
    const url = new URL(String(input));
    calls.push({ url, method: options.method, auth: options.headers.Authorization });
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(url.searchParams.has("access_token"), false);
    assert.equal(options.headers.Authorization, "Bearer " + token);
    assert.match(url.pathname, new RegExp("^/v26\\.0/act_" + accountId + "(/insights)?$"));
    if (delay) await delay();
    if (graphError)
      return Response.json(
        { error: { code: graphError, message: "Unsafe " + token } },
        { status: 400 },
      );
    if (!url.pathname.endsWith("/insights"))
      return Response.json({
        id: "act_" + accountId,
        account_id: accountId,
        name: "Compte fictif",
        currency,
        timezone_name: timeZone,
      });
    const range = JSON.parse(url.searchParams.get("time_range")!);
    if (url.searchParams.get("limit") === "1") return Response.json({ data: [] });
    if (url.searchParams.has("after"))
      return Response.json({
        data: duplicate ? [adRow(range.since)] : [adRow(range.since, secondAd)],
      });
    return Response.json({
      data:
        duplicate && !paged
          ? [adRow(range.since), adRow(range.since)]
          : spend === "EMPTY"
            ? []
            : [adRow(range.since)],
      ...(paged
        ? {
            paging: {
              next: "https://untrusted.example.invalid/?access_token=must-not-follow",
              cursors: { after: "SAFE_CURSOR" },
            },
          }
        : {}),
    });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await p?.$disconnect();
  await dropDatabase(database);
});

test("Money, ranges and date boundaries use exact units and the account calendar, including DST and ICU rules", () => {
  assert.equal(spendMicros("100.50"), 100500000n);
  assert.equal(deliveredCost(100000000n, 3), "33.333333");
  assert.equal(deliveredCost(1n, 0), null);
  for (const value of ["-1", "1e3", "1,00", 10, "1.0000001", "NaN", "9999999999999"])
    assert.throws(() => spendMicros(value));
  assert.equal(mediaDays("2026-11-01", "2026-11-28").length, 28);
  assert.throws(() => mediaDays("2026-02-31", "2026-03-01"));
  assert.throws(() => mediaDays("2026-01-01", "2026-05-01"));
  for (const zone of ["Africa/Casablanca", "America/New_York", "Asia/Tokyo", "Pacific/Auckland"])
    for (const day of ["2026-11-20", "2026-03-08", "2026-11-01"]) {
      const start = mediaBoundary(day, zone),
        end = mediaBoundary(day, zone, true);
      assert.equal(mediaToday(zone, start), day);
      assert.notEqual(mediaToday(zone, new Date(start.getTime() - 1)), day);
      assert.equal(mediaToday(zone, new Date(end.getTime() - 1)), day);
      assert.notEqual(mediaToday(zone, end), day);
      assert(
        end.getTime() - start.getTime() >= 23 * 3600000 &&
          end.getTime() - start.getTime() <= 25 * 3600000,
      );
    }
});
test("Only opt-in media readers can read; only an administrator can configure; no configuration leaks a token", async () => {
  await request(app).get("/api/media-buyer/connection").expect(401);
  await api("get", "connection", header(staffId, "STAFF")).expect(403);
  const empty = (await api("get", "connection", header(readerId, "STAFF")).expect(200)).body.data;
  assert.equal(empty.connected, false);
  assert.equal(empty.canManage, false);
  await api("put", "target", header(readerId, "STAFF"))
    .send({ revision: 0, targetCents: 5000 })
    .expect(403);
  await api("post", "connection")
    .send({ revision: 0, currentPassword: "wrong", accountId, token })
    .expect(400);
  const r = await api("post", "connection")
    .send({ revision: 0, currentPassword: pwd, accountId: "act_" + accountId, token })
    .expect(200);
  assert.equal(r.body.data.accountId, accountId);
  assert.equal(r.body.data.currency, "MAD");
  assert.equal(r.body.data.timeZone, timeZone);
  assert.doesNotMatch(JSON.stringify(r.body), /ciphertext|Meta-fixture-token|Unsafe/);
  const stored = await cfg();
  assert(stored.tokenCiphertext);
  assert(!stored.tokenCiphertext.includes(token));
  assert.equal(stored.revision, 1);
  await api("put", "target").send({ revision: 0, targetCents: 5000 }).expect(409);
  await api("put", "target").send({ revision: 1, targetCents: 5000 }).expect(200);
  assert.equal((await cfg()).revision, 2);
  assert.equal(await p.accessEvent.count({ where: { action: "MEDIA_BUYER_CONNECTED" } }), 1);
});
test("Two syncs replace daily spend without double counting; IDs survive renames and unrelated commerce stays byte-identical", async () => {
  const before = await commerce();
  const first = (
    await api("post", "sync")
      .send({ from, to, revision: (await cfg()).revision })
      .expect(200)
  ).body.data;
  assert.equal(first.rows, 1);
  assert.equal(await p.metaDailySpend.count(), 1);
  assert.equal((await p.metaDailySpend.findFirst()).spendMicros, 100500000n);
  names = "Renommée";
  spend = "120.25";
  await api("post", "sync")
    .send({ from, to, revision: (await cfg()).revision })
    .expect(200);
  assert.equal(await p.metaDailySpend.count(), 1);
  assert.equal((await p.metaDailySpend.findFirst()).spendMicros, 120250000n);
  assert.equal((await p.metaAd.findFirst()).adName, "Renommée annonce");
  assert.equal(await p.metaSyncDay.count(), 1);
  assert.equal(await commerce(), before);
  const r = await getReport();
  assert.equal(r.totals.spend, "120.250000");
  assert.equal(r.targetCents, 5000);
  assert.equal(r.totals.costPerDelivered, null);
  assert.equal(r.coverage.complete, true);
  assert.equal(r.collectedRevenue, null);
});
test("Pagination follows only a safe cursor on the fixed official origin; incomplete duplicate/error runs never erase cached spending", async () => {
  const previous = (await cfg()).lastSyncAt.toISOString();
  duplicate = true;
  await assert.rejects(sync(), /incomplète ou invalide/);
  duplicate = false;
  assert.equal(await p.metaDailySpend.count(), 1);
  assert.equal((await cfg()).lastSyncAt.toISOString(), previous);
  assert.match((await cfg()).lastError, /incomplète ou invalide/);
  graphError = 190;
  await assert.rejects(sync(), /expiré ou invalide/);
  graphError = 0;
  assert.equal(await p.metaDailySpend.count(), 1);
  assert.doesNotMatch(
    JSON.stringify(await lib.mediaConnection(actor)),
    new RegExp(token + "|Unsafe"),
  );
  paged = true;
  const output = await readMetaSpend(accountId, token, from, to, currency);
  assert.equal(output.length, 2);
  assert(calls.every((c) => c.url.hostname === "graph.facebook.com"));
  paged = false;
  spend = "EMPTY";
  await sync();
  assert.equal(await p.metaDailySpend.count(), 0);
  assert.equal((await getReport()).totals.spend, "0.000000");
  spend = "100.00";
  await sync();
});
test("Sync leases reject concurrent requests; account currency changes require reconnection and preserve earlier data", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  delay = () => {
    entered();
    return gate;
  };
  const running = sync();
  await started;
  await assert.rejects(sync(), /déjà en cours/);
  release();
  await running;
  delay = null;
  const before = (await p.metaDailySpend.findFirst()).spendMicros;
  currency = "USD";
  await assert.rejects(sync(), /devise ou le fuseau/);
  currency = "MAD";
  assert.equal((await p.metaDailySpend.findFirst()).spendMicros, before);
  await sync();
  await assert.rejects(sync({ from: "2026-11-21", to: "2026-11-20" }), /1 à 90/);
  await api("get", "report").query({ from: "2099-01-01", to: "2099-01-02" }).expect(400);
});
test("A real disconnect while Graph is reading invalidates the lease and never republishes cached figures or resurrects a token", async () => {
  const previous = (await p.metaDailySpend.findFirst()).spendMicros;
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
  delay = () => {
    entered();
    return gate;
  };
  const running = sync();
  await started;
  await lib.disconnectMeta(actor, { revision: (await cfg()).revision, currentPassword: pwd });
  delay = null;
  release();
  await assert.rejects(running, /réglages Media Buyer ont changé/);
  assert.equal((await cfg()).tokenCiphertext, null);
  assert.equal((await cfg()).syncLease, null);
  assert.equal((await p.metaDailySpend.findFirst()).spendMicros, previous);
  await lib.connectMeta(actor, {
    revision: (await cfg()).revision,
    currentPassword: pwd,
    accountId,
    token,
  });
});
test("Creation cohorts, real delivery/return codes, historic confirmations, unknown source and deleted orders produce a net delivered CPA", async () => {
  const tag = {
    campaignAttribution: touch(),
    campaignAttributionExpiresAt: new Date("2026-12-20T00:00:00Z"),
  };
  const base = {
    customerName: "Fictif",
    customerPhone: "+212600000099",
    city: "Test",
    paymentMethod: "COD",
    paymentStatus: "PENDING",
    totalAmount: 230,
    shippingCost: 30,
    createdAt: mediaBoundary(from, timeZone),
    ...tag,
  };
  const cases = [
    { status: "DELIVERED", carrier: "DELIVERED" },
    { status: "CANCELLED", carrier: "RETURNED" },
    { status: "SHIPPED", carrier: "TRANSIT" },
    { status: "CANCELLED", carrier: "CUSTOMER_CANCELED" },
    { status: "CONFIRMED", carrier: null },
    { status: "DELIVERED", carrier: "FUTURE_CODE" },
    { status: "CANCELLED", carrier: "RETURNING" },
    { status: "DELIVERED", carrier: null, deletedAt: new Date() },
  ];
  for (const c of cases) {
    const { carrier, ...value } = c,
      o = await p.order.create({ data: { ...base, ...value } });
    if (carrier)
      await p.olivraisonShipment.create({
        data: { id: o.id, carrierStatus: carrier, trackingId: "FICTIF-" + o.id, state: "DONE" },
      });
    if (carrier === "RETURNED")
      await p.orderEvent.create({
        data: { orderId: o.id, type: "status_changed", message: "Order marked as CONFIRMED (crm)" },
      });
  }
  await p.order.create({
    data: {
      ...base,
      status: "DELIVERED",
      campaignAttribution: undefined,
      campaignAttributionExpiresAt: null,
    },
  });
  await p.order.create({
    data: {
      ...base,
      status: "DELIVERED",
      campaignAttribution: { ...touch(), consentVersion: "legacy" },
    },
  });
  await p.order.create({
    data: {
      ...base,
      status: "DELIVERED",
      campaignAttribution: { ...touch(), tags: { ...touch().tags, ad_id: secondAd } },
    },
  });
  await p.order.create({
    data: {
      ...base,
      status: "DELIVERED",
      createdAt: new Date(mediaBoundary(from, timeZone).getTime() - 1),
    },
  });
  await p.order.create({
    data: { ...base, status: "DELIVERED", createdAt: mediaBoundary(to, timeZone, true) },
  });
  const before = await commerce(),
    r = await getReport();
  assert.equal(r.totals.attributed, 8);
  assert.equal(r.totals.delivered, 2);
  assert.equal(r.totals.returned, 1);
  assert.equal(r.totals.returning, 1);
  assert.equal(r.totals.cancelled, 1);
  assert.equal(r.totals.inDelivery, 1);
  assert.equal(r.totals.review, 1);
  assert.equal(r.totals.awaiting, 1);
  assert.equal(r.totals.confirmed, 6);
  assert.equal(r.totals.spend, "100.000000");
  assert.equal(r.totals.costPerDelivered, "50.000000");
  assert.equal(r.unknown.attributed, 3);
  assert.equal(r.unknown.delivered, 3);
  assert.equal(r.unknownWithAdId, 2);
  assert.equal(r.collectedRevenue, null);
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Tokyo", "UTC"]) {
      await p.$queryRaw`SELECT set_config('TimeZone', ${zone}, false)`;
      const zoned = await getReport();
      assert.deepEqual(
        zoned.totals,
        r.totals,
        "The account cohort must not change with the PostgreSQL session timezone",
      );
      assert.deepEqual(zoned.unknown, r.unknown);
      assert.deepEqual(zoned.coverage, r.coverage);
    }
  } finally {
    await p.$queryRaw`SELECT set_config('TimeZone', 'UTC', false)`;
  }
  const parcel = await p.olivraisonShipment.findFirst({ where: { carrierStatus: "DELIVERED" } });
  await p.olivraisonShipment.update({
    where: { id: parcel.id },
    data: { carrierStatus: "RETURNED" },
  });
  const returned = await getReport();
  assert.equal(returned.totals.delivered, 1);
  assert.equal(returned.totals.returned, 2);
  assert.equal(returned.totals.costPerDelivered, "100.000000");
  await p.olivraisonShipment.update({
    where: { id: parcel.id },
    data: { carrierStatus: "ARCHIVED" },
  });
  const archived = await getReport();
  assert.equal(
    archived.totals.delivered,
    1,
    "Archiving must not resurrect a delivery after an observed return",
  );
  assert.equal(archived.totals.review, 2);
  assert.equal(archived.totals.costPerDelivered, "100.000000");
  await p.olivraisonShipment.update({
    where: { id: parcel.id },
    data: { carrierStatus: "DELIVERED" },
  });
  // Repeated reads do not change orders, payments, stock, events, or carrier state/timestamps.
  const stable = await commerce();
  await getReport();
  await getReport();
  assert.equal(await commerce(), stable);
  const incomplete = await getReport({ to: "2026-11-21" });
  assert.equal(incomplete.coverage.complete, false);
  assert.equal(incomplete.totals.spend, null);
  assert.equal(incomplete.totals.costPerDelivered, null);
  const filtered = await getReport({ campaignId, adsetId, adId });
  assert.equal(filtered.ads.length, 1);
  assert.equal(
    filtered.recommendations[0].counts.attributed,
    r.recommendations[0].counts.attributed,
  );
  await assert.rejects(getReport({ adId: secondAd }), /pas connue/);
  await assert.rejects(getReport({ campaignId: "99999" }), /filtres publicitaires/);
  assert(before.length > 0);
  const expired = await p.order.create({ data: { ...base, status: "PENDING", campaignAttributionExpiresAt: new Date(now.getTime() - 1) } });
  const { purgeExpiredCampaigns } = await import("../backend/src/lib/campaign-attribution");
  try {
    await p.$queryRaw`SELECT set_config('TimeZone', 'America/Los_Angeles', false)`;
    await purgeExpiredCampaigns(now);
    const cleared = await p.order.findUniqueOrThrow({ where: { id: expired.id } });
    assert.equal(cleared.campaignAttribution, null); assert.equal(cleared.campaignAttributionExpiresAt, null);
    const business = ({ campaignAttribution: _a, campaignAttributionExpiresAt: _e, ...rest }: any) => rest;
    assert.deepEqual(business(cleared), business(expired), "Retention changes no commercial field or business timestamp");
  } finally { await p.$queryRaw`SELECT set_config('TimeZone', 'UTC', false)`; }
});
test("Recommendations are justified, conservative, currency-aware and never propose an automatic Meta write", () => {
  const { mediaRecommendation } = report;
  const counts = {
    ...emptyMediaCounts(),
    attributed: 20,
    delivered: 18,
    confirmed: 20,
    mature: 20,
    cancelled: 2,
  };
  const input = {
    campaignId,
    campaignName: "Fictif",
    counts,
    micros: 500000000n,
    complete: true,
    currency: "MAD",
    targetCents: 5000,
    connected: true,
    fresh: true,
    unknown: 0,
    allOrders: 20,
  };
  assert.equal(mediaRecommendation(input).action, "scale");
  assert.equal(mediaRecommendation({ ...input, counts: { ...counts, mature: 0 } }).action, "test");
  assert.equal(
    mediaRecommendation({ ...input, counts: { ...counts, delivered: 2 } }).action,
    "test",
  );
  assert.equal(mediaRecommendation({ ...input, currency: "USD" }).action, "currency");
  assert.equal(mediaRecommendation({ ...input, targetCents: null }).action, "target");
  assert.equal(mediaRecommendation({ ...input, fresh: false }).action, "sync");
  assert.equal(mediaRecommendation({ ...input, complete: false }).spend, null);
  assert.equal(mediaRecommendation({ ...input, unknown: 6, allOrders: 26 }).action, "review");
  assert.equal(
    mediaRecommendation({ ...input, counts: { ...counts, cancelled: 5 } }).action,
    "review",
  );
  assert.equal(mediaRecommendation({ ...input, micros: 2000000000n }).action, "cost");
});
test("Disconnect and account/MFA changes invalidate in-flight credentials; browser writes require identity and origin", async () => {
  const revision = (await cfg()).revision;
  await api("post", "disconnect").send({ revision, currentPassword: pwd }).expect(200);
  const r = await api("get", "connection").expect(200);
  assert.equal(r.body.data.connected, false);
  assert.equal((await cfg()).tokenCiphertext, null);
  assert.equal(await p.metaDailySpend.count(), 1);
  await assert.rejects(sync(), /Connectez le compte/);
  await api("post", "connection")
    .send({ revision: (await cfg()).revision, currentPassword: pwd, accountId: "99999", token: "" })
    .expect(400);
  // An enabled MFA must be proven as well as the password before contacting Meta.
  await p.adminMfa.create({
    data: { userId: uid, secretCiphertext: "unusable-fixture", enabledAt: new Date() },
  });
  const before = calls.length;
  await api("post", "connection")
    .send({ revision: (await cfg()).revision, currentPassword: pwd, accountId, token })
    .expect(400);
  assert.equal(calls.length, before);
  await p.adminMfa.delete({ where: { userId: uid } });
  const login = await request(app)
    .post("/api/auth/login")
    .set({ Origin: "https://media.example.invalid", "X-Imad-Admin-Session": "cookie" })
    .send({ email: actor.email, password: pwd })
    .expect(200);
  const cookies = login.headers["set-cookie"].map((s: string) => s.split(";")[0]);
  await request(app)
    .put("/api/media-buyer/target")
    .set("Cookie", cookies)
    .send({ revision: (await cfg()).revision, targetCents: 100 })
    .expect(403);
  assert(calls.every((c) => c.method === "GET" && c.url.host === "graph.facebook.com"));
});
