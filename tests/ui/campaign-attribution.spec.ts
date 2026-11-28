import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
const { databaseUrl, createDatabase, dropDatabase } = require("../../scripts/test-postgres.cjs");
const origin = "https://campaign.example.test";
const name = `imad_ci_${randomBytes(8).toString("hex")}`;
let prisma: PrismaClient, server: Server, apiOrigin: string;
const nativeFetch = globalThis.fetch;
const accountId = "12345678901234567890",
  adId = "34567890123456789012",
  campaignId = "12345678901234567890",
  adsetId = "23456789012345678901";
const metaFixtureToken = "Meta-isolated-ui-fixture-no-real-access";
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
test.beforeAll(async () => {
  test.setTimeout(120_000);
  // Never inherit a live integration or source database; all customer data here are fictional.
  for (const key of Object.keys(process.env))
    if (
      /^(GOOGLE_|TELEGRAM_BOT_|SMTP_|RESEND_|STRIPE_|STORE_INSTANCE_ID$|STORE_SETUP_MODE$|STORE_DISPLAY_NAME$|CRM_COMPANY_ID$|DESKCOMM_)/.test(
        key,
      )
    )
      delete process.env[key];
  Object.assign(process.env, {
    NODE_ENV: "test",
    INTEGRATION_TEST_MODE: "true",
    DATABASE_URL: databaseUrl(name),
    JWT_SECRET: "campaign-ui-fixture-only",
    JWT_REFRESH_SECRET: "campaign-ui-refresh-only",
    DESKCOMM_ENCRYPTION_KEY: "ab".repeat(32),
    UPLOAD_DIR: process.cwd() + "/.test-runtime/" + name + "/uploads",
  });
  globalThis.fetch = (async (
    input: Parameters<typeof fetch>[0],
    options?: Parameters<typeof fetch>[1],
  ) => {
    const url = new URL(String(input));
    if (url.origin === "https://graph.facebook.com") {
      expect(options?.method).toBe("GET");
      expect(new Headers(options?.headers).get("authorization")).toBe("Bearer " + metaFixtureToken);
      expect(url.searchParams.has("access_token")).toBe(false);
      expect(url.pathname).toMatch(new RegExp("^/v26\\.0/act_" + accountId + "(/insights)?$"));
      if (!url.pathname.endsWith("/insights"))
        return Response.json({
          id: "act_" + accountId,
          account_id: accountId,
          name: "Compte isolé",
          currency: "MAD",
          timezone_name: "Africa/Casablanca",
        });
      const range = JSON.parse(url.searchParams.get("time_range")!);
      return Response.json({
        data:
          range.since <= today() && range.until >= today()
            ? [
                {
                  account_id: accountId,
                  account_currency: "MAD",
                  ad_id: adId,
                  ad_name: "Annonce isolée",
                  adset_id: adsetId,
                  adset_name: "Ensemble isolé",
                  campaign_id: campaignId,
                  campaign_name: "Campagne isolée",
                  date_start: today(),
                  date_stop: today(),
                  spend: "50.00",
                },
              ]
            : [],
      });
    }
    if (url.protocol === "http:" && url.hostname === "127.0.0.1")
      return nativeFetch(input, options);
    throw new Error("External calls forbidden in the isolated journey");
  }) as typeof fetch;
  await createDatabase(name);
  ({ prisma } = require("../../backend/dist/lib/prisma.js"));
  await prisma.category.create({
    data: {
      id: "111111111111111111111111",
      slug: "campaign-fixture",
      nameFr: "Test",
      nameAr: "اختبار",
      nameEn: "Test",
    },
  });
  await prisma.product.create({
    data: {
      id: "222222222222222222222222",
      slug: "campaign-isolated",
      nameFr: "Produit fictif",
      nameAr: "منتج تجريبي",
      nameEn: "Fixture",
      descriptionFr: "",
      descriptionAr: "",
      descriptionEn: "",
      categoryId: "111111111111111111111111",
      price: 230,
      freeShipping: true,
      status: "ACTIVE",
      images: [],
      variants: {
        create: {
          id: "333333333333333333333330",
          sku: "CAMPAIGN-FIXTURE-40",
          color: "#000000",
          colorNameFr: "Noir",
          colorNameAr: "أسود",
          colorNameEn: "Black",
          size: "40",
          stock: 10,
        },
      },
    },
  });
  const { app } = require("../../backend/dist/app.js");
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  apiOrigin = "http://127.0.0.1:" + (server.address() as { port: number }).port;
});
test.beforeEach(async () => {
  await prisma.olivraisonShipment.deleteMany();
  await prisma.order.deleteMany();
});
test.afterAll(async () => {
  globalThis.fetch = nativeFetch;
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma?.$disconnect();
  await dropDatabase(name);
});
async function fixture(page: Page) {
  // Every browser request is handled locally or blocked, including advertising and communications.
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(origin + "/")) {
      const suffix = url.slice(origin.length);
      const target = suffix.startsWith("/api/orders") ? apiOrigin : "http://127.0.0.1:3131";
      const response = await route.fetch({ url: target + suffix });
      return route.fulfill({ response });
    }
    return route.abort();
  });
}
async function purchase(page: Page) {
  await page.goto(`${origin}/products/fixture-sabot`);
  await page.getByRole("button", { name: "40", exact: true }).click();
  await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
  await page.getByRole("link", { name: "متابعة الطلب", exact: true }).click();
  await page.locator("#checkout-fullName").fill("Client fictif");
  await page.locator("#checkout-phone").fill("0600000099");
  await page.locator("#checkout-city").fill("Tanger");
  await page.getByRole("option").first().click();
  await page.locator("#checkout-address").fill("Adresse fictive 1");
  await page.getByRole("button", { name: "مراجعة الطلب", exact: true }).click();
  const response = page.waitForResponse(
    (r) => r.url() === origin + "/api/orders" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "أؤكد طلبي", exact: true }).click();
  const receipt = await (await response).json();
  expect(receipt.success).toBe(true);
  await expect(page.locator(".order-receipt-dialog")).toBeVisible();
  return receipt.data.id as string;
}
for (const width of [390, 1440]) {
  test(`Public campaign click, consent, navigation, checkout and persisted order at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await fixture(page);
    await page.goto(
      `${origin}/shop?utm_source=facebook&utm_medium=paid_social&utm_campaign=fixture&campaign_id=12345678901234567890&adset_id=23456789012345678901&ad_id=34567890123456789012&fbclid=ignored`,
    );
    await expect(page.locator(".pixel-choice")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("consent.png"), fullPage: true });
    expect(await page.evaluate(() => localStorage.getItem("imad:campaign-touch:v1"))).toBeNull();
    await page.getByRole("button", { name: "تفعيل التتبع", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("imad:campaign-touch:v1")))
      .not.toBeNull();
    await page.goto(`${origin}/shop`);
    await page.reload();
    const id = await purchase(page);
    await page.screenshot({ path: test.info().outputPath("receipt.png"), fullPage: true });
    const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    expect(order.campaignAttribution).toMatchObject({
      model: "last_tagged_touch_30d",
      tags: {
        campaign_id: "12345678901234567890",
        adset_id: "23456789012345678901",
        ad_id: "34567890123456789012",
        utm_campaign: "fixture",
      },
    });
    expect(JSON.stringify(order.campaignAttribution)).not.toContain("fbclid");
    expect(order.totalAmount).toBe(230);
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.items).toHaveLength(1);
    expect(await prisma.deskcommOutbox.count()).toBe(0);
    expect(await prisma.olivraisonShipment.count()).toBe(0);
    const before = await prisma.order.count();
    await page.reload();
    expect(await prisma.order.count()).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // Continue the same real isolated order through delivery and the actual reporting API.
    // Only the disposable carrier row is simulated; no carrier integration is enabled.
    const day = today();
    await prisma.user.upsert({
      where: { id: "a".repeat(24) },
      create: {
        id: "a".repeat(24),
        email: "media-owner@example.invalid",
        passwordHash: "no-login-fixture",
        role: "ADMIN",
        firstName: "Test",
        lastName: "Owner",
      },
      update: {},
    });
    const { encryptDeskcommValue } = require("../../backend/dist/lib/deskcomm-config.js");
    await prisma.mediaBuyerConnection.upsert({
      where: { id: "meta" },
      create: {
        id: "meta",
        accountId,
        accountName: "Compte isolé",
        currency: "MAD",
        timeZone: "Africa/Casablanca",
        targetCents: 5000,
        tokenCiphertext: encryptDeskcommValue(
          JSON.stringify({ version: 1, accountId, token: metaFixtureToken }),
        ),
      },
      update: {},
    });
    await prisma.order.update({ where: { id }, data: { status: "DELIVERED" } });
    await prisma.olivraisonShipment.create({
      data: {
        id,
        trackingId: "ISOLATED-NO-REAL-PARCEL-" + id,
        carrierStatus: "DELIVERED",
        state: "DONE",
      },
    });
    const beforeRead = await prisma.order.findUniqueOrThrow({ where: { id } }),
      stockBefore = await prisma.productVariant.findMany({ orderBy: { id: "asc" } });
    const auth =
      "Bearer " + jwt.sign({ id: "a".repeat(24), role: "ADMIN" }, process.env.JWT_SECRET!);
    const firstDay = new Date(Date.parse(day) - 6 * 86400000).toISOString().slice(0, 10);
    for (let run = 0; run < 2; run++) {
      const revision = (
        await prisma.mediaBuyerConnection.findUniqueOrThrow({ where: { id: "meta" } })
      ).revision;
      const response = await fetch(apiOrigin + "/api/media-buyer/sync", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ from: firstDay, to: day, revision }),
      });
      expect(response.status).toBe(200);
      expect(await prisma.metaDailySpend.count()).toBe(1);
      expect((await prisma.metaDailySpend.findFirstOrThrow()).spendMicros).toBe(50000000n);
      expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toEqual(beforeRead);
      expect(await prisma.productVariant.findMany({ orderBy: { id: "asc" } })).toEqual(stockBefore);
    }

    await page.route(origin + "/api/media-buyer/**", async (route) => {
      const response = await route.fetch({
        url:
          apiOrigin +
          new URL(route.request().url()).pathname +
          new URL(route.request().url()).search,
        headers: { Authorization: auth },
      });
      return route.fulfill({ response });
    });
    await page.route(origin + "/api/auth/session", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            mode: "cookie",
            identity: { id: "a".repeat(24), role: "ADMIN", authVersion: 0, permissions: [] },
          },
        },
      }),
    );
    await page.goto(origin + "/admin?tab=media");
    await expect(page.locator(".media-kpis")).toBeVisible();
    await expect(page.locator(".media-table tbody")).toContainText("Annonce isolée");
    await expect(page.locator(".media-kpis .admin-panel").nth(2)).toContainText("1");
    await expect(page.locator(".media-kpis .admin-panel").last()).toContainText(/50[,.]00/);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: test.info().outputPath("attributed-delivered-report.png"),
      fullPage: true,
    });
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toEqual(beforeRead);
    expect(await prisma.productVariant.findMany({ orderBy: { id: "asc" } })).toEqual(stockBefore);
    expect(await prisma.deskcommOutbox.count()).toBe(0);
    expect(await prisma.olivraisonShipment.count()).toBe(1);
  });
}
test("Refusing or withdrawing still permits checkout without campaign metadata", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await fixture(page);
  await page.goto(`${origin}/shop?utm_source=facebook&ad_id=12345`);
  await page.getByRole("button", { name: "تفعيل التتبع", exact: true }).click();
  await page.locator(".pixel-preference").click();
  await page.getByRole("button", { name: "إيقاف التتبع", exact: true }).click();
  const id = await purchase(page);
  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  expect(order.campaignAttribution).toBeNull();
  expect(order.campaignAttributionExpiresAt).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("imad:campaign-touch:v1"))).toBeNull();
  await prisma.user.upsert({
    where: { id: "a".repeat(24) },
    create: {
      id: "a".repeat(24),
      email: "media-owner@example.invalid",
      passwordHash: "no-login-fixture",
      role: "ADMIN",
      firstName: "Test",
      lastName: "Owner",
    },
    update: {},
  });
  const day = today();
  const response = await fetch(apiOrigin + "/api/media-buyer/report?from=" + day + "&to=" + day, {
    headers: {
      Authorization:
        "Bearer " + jwt.sign({ id: "a".repeat(24), role: "ADMIN" }, process.env.JWT_SECRET!),
    },
  });
  expect(response.status).toBe(200);
  const report = (await response.json()).data;
  expect(report.unknown.attributed).toBe(1);
  expect(report.unknown.delivered).toBe(0);
  expect(report.totals.attributed).toBe(0);
  expect((await prisma.order.findUniqueOrThrow({ where: { id } })).paymentStatus).toBe("PENDING");
  expect(await prisma.olivraisonShipment.count()).toBe(0);
});

test("Advertising choice waits for the pixel settings and refusal targets the configured pixel", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${origin}/api/settings`, async (route) => {
    await ready;
    await route.fulfill({
      json: {
        success: true,
        data: {
          shippingCost: 45,
          freeShippingMin: 500,
          codEnabled: true,
          metaPixelEnabled: true,
          metaPixelId: "123456789",
          metaPixelMadPerUsd: 10,
        },
      },
    });
  });
  await page.goto(`${origin}/shop?ad_id=12345`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".pixel-choice")).toBeHidden();
  release();
  await expect(page.locator(".pixel-choice")).toBeVisible();
  await page.getByRole("button", { name: "إيقاف التتبع", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("imad-meta-consent:123456789"))).toBe(
    "denied",
  );
  expect(await page.evaluate(() => localStorage.getItem("imad:campaign-touch:v1"))).toBeNull();
});

test("A tagged client-side URL change on the same page captures the new ad without merging old IDs", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(origin + "/shop?campaign_id=12345&adset_id=23456&ad_id=34567");
  await page.getByRole("button", { name: "تفعيل التتبع", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("imad:campaign-touch:v1")!).tags.ad_id),
    )
    .toBe("34567");
  await page.evaluate(() =>
    window.history.pushState(null, "", "/shop?campaign_id=88888&adset_id=77777&ad_id=66666"),
  );
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("imad:campaign-touch:v1")!).tags.ad_id),
    )
    .toBe("66666");
  const tags = await page.evaluate(
    () => JSON.parse(localStorage.getItem("imad:campaign-touch:v1")!).tags,
  );
  expect(tags).toEqual({ campaign_id: "88888", adset_id: "77777", ad_id: "66666" });
  await page.goto(origin + "/shop");
  await page.reload();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("imad:campaign-touch:v1")!).tags),
  ).toEqual(tags);
});
