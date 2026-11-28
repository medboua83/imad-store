import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  emptyMediaCounts,
  META_URL_PARAMETERS,
  type MediaConnection,
  type MediaReport,
} from "../../packages/shared/src";
const ids = {
  campaign: "23456789012345678901",
  adset: "34567890123456789012",
  ad: "45678901234567890123",
};
const identity = { id: "a".repeat(24), role: "ADMIN", authVersion: 0, permissions: [] };
async function fixture(
  context: BrowserContext,
  role: "ADMIN" | "STAFF" = "ADMIN",
  permitted = true,
) {
  const cfg: MediaConnection = {
    revision: 2,
    connected: true,
    accountId: "12345678901234567890",
    accountName: "Compte fictif",
    currency: "MAD",
    timeZone: "Africa/Casablanca",
    today: "2026-11-28",
    targetCents: 5000,
    lastSyncAt: "2026-11-28T09:00:00Z",
    lastError: null,
    syncing: false,
    mfaEnabled: true,
    canManage: role === "ADMIN",
  };
  const counts = {
    ...emptyMediaCounts(),
    attributed: 20,
    confirmed: 18,
    delivered: 10,
    cancelled: 3,
    returned: 2,
    inDelivery: 4,
    awaiting: 1,
    mature: 18,
  };
  const row = {
    ...counts,
    adId: ids.ad,
    adName: "Annonce fictive",
    campaignId: ids.campaign,
    campaignName: "Campagne fictive",
    adsetId: ids.adset,
    adsetName: "Ensemble fictif",
    spend: "500.000000",
    costPerDelivered: "50.000000",
  };
  const data: MediaReport = {
    from: "2026-11-22",
    to: cfg.today,
    timeZone: cfg.timeZone,
    currency: cfg.currency,
    accountId: cfg.accountId,
    checkedAt: "2026-11-28T09:00:00Z",
    targetCents: cfg.targetCents,
    coverage: { complete: true, missingDays: 0, oldestSyncAt: cfg.lastSyncAt },
    unknown: { ...emptyMediaCounts(), attributed: 2, delivered: 1 },
    unknownWithAdId: 1,
    totals: { ...counts, spend: row.spend, costPerDelivered: row.costPerDelivered },
    ads: [row],
    choices: [row],
    recommendations: [
      {
        campaignId: ids.campaign,
        campaignName: "Campagne fictive",
        action: "test",
        reasons: ["pending_orders"],
        counts,
        spend: row.spend,
        costPerDelivered: row.costPerDelivered,
      },
    ],
    collectedRevenue: null,
  };
  const state = {
    cfg,
    data,
    reads: [] as URL[],
    writes: [] as { path: string; body: any }[],
    failRead: false,
    lostReply: false,
    release: null as null | (() => void),
    gated: false,
  };
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/auth/session" || path === "/api/auth/refresh")
      return route.fulfill({
        json: {
          success: true,
          data: {
            mode: "cookie",
            identity: {
              ...identity,
              role,
              permissions: role === "STAFF" && permitted ? ["media.read"] : [],
            },
          },
        },
      });
    if (path === "/api/media-buyer/connection" && req.method() === "GET")
      return route.fulfill({ json: { success: true, data: cfg } });
    if (path === "/api/media-buyer/report") {
      state.reads.push(url);
      if (state.failRead)
        return route.fulfill({
          status: 503,
          json: { success: false, error: "Rapport temporairement indisponible." },
        });
      return route.fulfill({
        json: {
          success: true,
          data: { ...data, from: url.searchParams.get("from"), to: url.searchParams.get("to") },
        },
      });
    }
    if (req.method() !== "GET") {
      state.writes.push({ path, body: req.postDataJSON() });
      if (!path.startsWith("/api/media-buyer/")) return route.fulfill({ status: 405 });
      if (state.gated)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      cfg.revision++;
      if (path.endsWith("/connection")) cfg.connected = true;
      if (path.endsWith("/target")) {
        cfg.targetCents = req.postDataJSON().targetCents;
        data.targetCents = cfg.targetCents;
      }
      if (state.lostReply) return route.abort("failed");
      return route.fulfill({ json: { success: true, data: cfg } });
    }
    return route.fulfill({
      json: {
        success: true,
        data:
          path === "/api/settings"
            ? { shippingCost: 30, metaPixelEnabled: false, codEnabled: true }
            : [],
        total: 0,
        totalPages: 1,
        unread: 0,
      },
    });
  });
  return state;
}
async function start(page: Page, locale: "fr" | "ar" = "fr") {
  await page.goto("/admin?tab=media");
  await expect(page.locator(".media-buyer")).toBeVisible();
  if (locale === "ar")
    await page
      .getByRole("combobox", { name: "Langue de l’administration / لغة لوحة الإدارة" })
      .selectOption("ar");
  await expect(page.locator(".media-kpis")).toBeVisible();
  return page.locator(".media-buyer");
}
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: "ignoreErrors" });
});
for (const width of [390, 768, 1440])
  for (const locale of ["fr", "ar"] as const)
    test(`Media Buyer readable filters, attribution template and no unrequested writes at ${width}px ${locale}`, async ({
      page,
      context,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const s = await fixture(context),
        panel = await start(page, locale);
      await expect(panel.locator(".media-kpis .admin-panel")).toHaveCount(4);
      await expect(panel.locator(".media-kpis")).toContainText("20");
      await expect(panel.locator(".media-table tbody tr")).toHaveCount(1);
      await expect(panel.locator(".media-unknown")).toContainText("2");
      await expect(panel.locator(".media-template")).toHaveValue(META_URL_PARAMETERS);
      if (width === 1440 && locale === "fr") {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await panel.getByRole("button", { name: "Copier le modèle", exact: true }).click();
        await expect(
          panel.getByRole("button", { name: "Modèle copié", exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(META_URL_PARAMETERS);
      }
      const selects = panel.locator(".media-filters select");
      await selects.nth(0).selectOption(ids.campaign);
      await selects.nth(1).selectOption(ids.adset);
      await selects.nth(2).selectOption(ids.ad);
      await panel
        .getByRole("button", { name: locale === "fr" ? "Afficher" : "عرض", exact: true })
        .click();
      await expect.poll(() => s.reads.at(-1)?.searchParams.get("adId")).toBe(ids.ad);
      await expect(panel.locator(".media-kpis")).toBeVisible();
      expect(s.reads.at(-1)?.searchParams.get("campaignId")).toBe(ids.campaign);
      expect(s.reads.at(-1)?.searchParams.get("adsetId")).toBe(ids.adset);
      expect(s.writes).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await expect(panel.locator(".media-kpis .admin-panel").last()).toBeInViewport({
        ratio: 0.25,
      });
      await page.screenshot({
        path: info.outputPath(`media-${width}-${locale}.png`),
        fullPage: true,
      });
    });
test("Incomplete sync never displays a zero cost; missing source and non-MAD target are explained", async ({
  page,
  context,
}) => {
  const s = await fixture(context);
  s.cfg.currency = s.data.currency = "USD";
  s.data.coverage = { complete: false, missingDays: 4, oldestSyncAt: null };
  s.data.totals.spend = null;
  s.data.totals.costPerDelivered = null;
  s.data.ads[0].spend = null;
  s.data.ads[0].costPerDelivered = null;
  const panel = await start(page);
  await expect(panel.getByText(/Dépenses incomplètes/)).toBeVisible();
  await expect(panel.locator(".media-kpis .admin-panel").first()).toContainText("—");
  await expect(panel.locator(".media-kpis .admin-panel").last()).toContainText("—");
  await expect(
    panel.getByText(
      "Le compte n’est pas en MAD. Une conversion fiable est nécessaire pour comparer le coût cible.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(panel.locator(".media-unknown")).toContainText("non rapproché");
  expect(s.writes).toEqual([]);
});
test("Read-only collaborators see performance but no connection, sync, or target controls; others cannot open the module", async ({
  page,
  context,
}) => {
  const s = await fixture(context, "STAFF"),
    panel = await start(page);
  await expect(
    panel.getByRole("button", { name: "Synchroniser les dépenses de cette période" }),
  ).toHaveCount(0);
  await expect(panel.getByText("Réglages Media Buyer", { exact: true })).toHaveCount(0);
  expect(s.writes).toEqual([]);
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await fixture(context, "STAFF", false);
  await page.reload();
  await expect(page.locator(".media-buyer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Media Buyer", exact: true })).toHaveCount(0);
});
test("Explicit connection requires password and MFA, double click makes one write, uncertain response clears every secret", async ({
  page,
  context,
}) => {
  const s = await fixture(context);
  s.lostReply = true;
  s.gated = true;
  const panel = await start(page);
  await panel.locator("summary").filter({ hasText: "Connexion au compte Meta Ads" }).click();
  const pass = panel.getByLabel("Mot de passe actuel", { exact: true }),
    token = panel.getByLabel("Jeton d’accès Meta", { exact: true }),
    code = panel.getByLabel("Code Authenticator ou code de secours", { exact: true });
  await token.fill("Fixture-token-never-real-2026");
  await pass.fill("Fixture-password-2026");
  await code.fill("123456");
  await panel.getByRole("button", { name: "Vérifier et connecter", exact: true }).dblclick();
  await expect.poll(() => s.writes.length).toBe(1);
  s.release!();
  await expect(panel.getByRole("alert")).toContainText("Résultat incertain");
  await expect(pass).toHaveValue("");
  await expect(token).toHaveValue("");
  await expect(code).toHaveValue("");
  const storage = await page.evaluate(() => Object.values(localStorage).join(""));
  expect(storage).not.toContain("Fixture-token");
  expect(storage).not.toContain("Fixture-password");
  expect(s.writes[0].body).toMatchObject({
    revision: 2,
    currentPassword: "Fixture-password-2026",
    token: "Fixture-token-never-real-2026",
    code: "123456",
  });
  await panel.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect(panel.locator(".media-kpis")).toBeVisible();
  expect(s.writes.length).toBe(1);
});
test("Target and sync use the currently displayed period/revision, and a failed report never retains obsolete KPIs", async ({
  page,
  context,
}) => {
  const s = await fixture(context),
    panel = await start(page);
  await panel.getByLabel("Coût cible par commande livrée (MAD)", { exact: true }).fill("45,50");
  await panel.getByRole("button", { name: "Enregistrer le coût cible", exact: true }).click();
  await expect.poll(() => s.writes.length).toBe(1);
  await expect(panel.locator(".media-kpis")).toBeVisible();
  expect(s.writes[0].body).toEqual({ revision: 2, targetCents: 4550 });
  await panel
    .getByRole("button", { name: "Synchroniser les dépenses de cette période", exact: true })
    .click();
  await expect.poll(() => s.writes.length).toBe(2);
  expect(s.writes[1].body).toEqual({ revision: 3, from: "2026-11-22", to: "2026-11-28" });
  await expect(panel.locator(".media-kpis")).toBeVisible();
  s.failRead = true;
  await panel.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Rapport temporairement indisponible");
  await expect(panel.locator(".media-kpis")).toHaveCount(0);
});

test("Recommendations display the target from their report snapshot when another administrator has changed it", async ({
  page,
  context,
}) => {
  const s = await fixture(context);
  s.cfg.targetCents = 2000;
  s.data.targetCents = 3500;
  const counts = {
    ...emptyMediaCounts(),
    attributed: 20,
    confirmed: 20,
    delivered: 18,
    returned: 2,
    mature: 20,
  };
  Object.assign(s.data.totals, counts, { costPerDelivered: "27.777778" });
  Object.assign(s.data.ads[0], counts, { costPerDelivered: "27.777778" });
  Object.assign(s.data.recommendations[0], {
    counts,
    action: "scale",
    reasons: ["cost_below_target"],
    costPerDelivered: "27.777778",
  });
  const panel = await start(page);
  await expect(panel.locator(".media-target")).toContainText(/35[,.]00/);
  await expect(panel.locator(".media-target")).not.toContainText(/20[,.]00/);
  await expect(
    panel.getByRole("heading", { name: "Envisager une hausse du budget", exact: true }),
  ).toBeVisible();
  expect(s.writes).toEqual([]);
});
