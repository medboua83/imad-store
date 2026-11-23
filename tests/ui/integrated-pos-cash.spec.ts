import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { actor, fixture, cart, add, sales } from "./fixtures/pos";
async function cashFixture(page: Page, locale = "fr", permissions = ["pos.sell"]) {
  const f = await fixture(page, permissions, locale),
    sessions = new Map<string, any>(),
    attempts = new Map<string, { kind: string; data: any }>();
  const state = {
    tracked: false,
    activeId: null as string | null,
    closeOffline: false,
    closeBeforeCommit: false,
    recoveryOffline: false,
  };
  const summary = (s: any) => {
    if (s.closing) return s;
    const receipts = [...f.receipts.values()].filter((r) => r.cashSessionId === s.id),
      cash = receipts.filter((r) => r.paymentMethod === "CASH"),
      card = receipts.filter((r) => r.paymentMethod === "CARD_TERMINAL");
    const cashCents = cash.reduce((n, r) => n + r.totalCents, 0),
      cardCents = card.reduce((n, r) => n + r.totalCents, 0);
    return {
      ...s,
      cashCents,
      cardCents,
      cashCount: cash.length,
      cardCount: card.length,
      expectedCents: s.openingCents + cashCents,
      balanceHash: createHash("sha256")
        .update(JSON.stringify([s.id, cashCents, cardCents, receipts.length]))
        .digest("hex"),
    };
  };
  await page.context().route(/\/api\/pos\/cash-sessions(?:\/|\?|$)/, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method(),
      key = req.headers()["idempotency-key"],
      body = method === "GET" ? null : req.postDataJSON();
    f.calls.push({ path, method, key, body, url: url.toString() });
    if (path.endsWith("/context"))
      return route.fulfill({
        json: {
          success: true,
          data: {
            enabled: state.tracked,
            active: state.activeId ? summary(sessions.get(state.activeId)) : null,
          },
        },
      });
    if (path.includes("/attempt/")) {
      if (state.recoveryOffline)
        return route.fulfill({ status: 503, json: { error: "Temporary offline" } });
      const r = attempts.get(decodeURIComponent(path.split("/").at(-1)!));
      return route.fulfill({
        status: r ? 200 : 404,
        json: r
          ? { success: true, kind: r.kind, data: summary(r.data) }
          : { error: "Cette opération de caisse n’est pas encore enregistrée." },
      });
    }
    if (path.endsWith("/open")) {
      let r = attempts.get(key!);
      if (!r) {
        const id = (sessions.size + 1).toString(16).padStart(24, "c"),
          s = {
            id,
            reference: "CAISSE-" + id.toUpperCase(),
            currency: "MAD",
            cashierId: actor,
            cashierName: "Caissier Test",
            openingCents: body.openingCents,
            openedAt: "2026-11-23T08:00:00Z",
            closing: null,
          };
        sessions.set(id, s);
        state.activeId = id;
        state.tracked = true;
        r = { kind: "open", data: s };
        attempts.set(key!, r);
      }
      return route.fulfill({ status: 201, json: { success: true, data: summary(r.data) } });
    }
    if (path.endsWith("/close")) {
      if (state.closeBeforeCommit) return route.abort("failed");
      let r = attempts.get(key!);
      if (!r) {
        const s = summary(sessions.get(body.sessionId));
        if (s.balanceHash !== body.balanceHash)
          return route.fulfill({
            status: 409,
            json: { error: "Des ventes ont été ajoutées. Recomptez la caisse avant de clôturer." },
          });
        const closed = {
          ...s,
          closing: {
            id: "d".repeat(24),
            countedCents: body.countedCents,
            differenceCents: body.countedCents - s.expectedCents,
            note: body.note,
            closedAt: "2026-11-23T18:00:00Z",
          },
        };
        sessions.set(closed.id, closed);
        state.activeId = null;
        r = { kind: "close", data: closed };
        attempts.set(key!, r);
      }
      if (state.closeOffline) return route.abort("failed");
      return route.fulfill({ status: 201, json: { success: true, data: r.data } });
    }
    if (path === "/api/pos/cash-sessions")
      return route.fulfill({
        json: {
          success: true,
          data: [...sessions.values()].map(summary),
          total: sessions.size,
          page: 1,
          totalPages: sessions.size ? 1 : 0,
          scope: permissions.includes("pos.read") ? "ALL" : "OWN",
        },
      });
    const s = sessions.get(path.split("/").at(-1)!);
    return route.fulfill({
      status: s ? 200 : 404,
      json: s ? { success: true, data: summary(s) } : { error: "Absent" },
    });
  });
  return { ...f, sessions, attempts, cashState: state, summary };
}
const panel = (page: Page) => page.locator(".pos-cash-panel");
async function openRegister(page: Page, ar = false) {
  await page.getByRole("button", { name: ar ? "صندوقي" : "Ma caisse", exact: true }).click();
  await panel(page)
    .getByLabel(ar ? "الرصيد الافتتاحي بالدرهم" : "Fond d’ouverture (MAD)")
    .fill("100");
  await panel(page)
    .getByRole("button", { name: ar ? "فتح صندوقي" : "Ouvrir ma caisse", exact: true })
    .click();
  await expect(
    panel(page).getByRole("heading", {
      name: ar ? "جلسة الصندوق مفتوحة" : "Session de caisse ouverte",
      exact: true,
    }),
  ).toBeVisible();
}
for (const [width, locale] of [
  [390, "fr"],
  [820, "ar"],
  [1440, "fr"],
] as const)
  test(`Cash session opens, counts net cash separately, closes and prints a private report at ${width}px ${locale}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const ar = locale === "ar",
      f = await cashFixture(page, locale);
    await page.goto("/admin?tab=pos");
    await openRegister(page, ar);
    await page.getByRole("button", { name: ar ? "تسجيل بيع" : "Encaisser", exact: true }).click();
    const addButton = ar
      ? page.getByRole("button", { name: "إضافة عباية تجريبية · أسود · M", exact: true })
      : add(page);
    await addButton.click();
    const basket = ar ? page.getByRole("complementary", { name: "سلة نقطة البيع" }) : cart(page);
    await basket
      .getByLabel(ar ? "المبلغ المستلم بالدرهم" : "Montant reçu (MAD)")
      .fill(ar ? "٥٠٠" : "500");
    await basket
      .getByRole("button", { name: ar ? "تأكيد تسجيل الأداء" : "Valider l’encaissement" })
      .click();
    await expect(
      page.getByRole("heading", { name: ar ? "تم تسجيل الأداء" : "Vente encaissée", exact: true }),
    ).toBeVisible();
    const sessionId = [...f.sessions.keys()][0];
    expect(sales(f)[0].body.cashSessionId).toBe(sessionId);
    await page.getByRole("button", { name: ar ? "صندوقي" : "Ma caisse", exact: true }).click();
    await expect(panel(page).locator(".pos-cash-totals")).toContainText("330");
    await panel(page)
      .getByRole("button", { name: ar ? "التحضير للإغلاق" : "Préparer la clôture" })
      .click();
    await panel(page)
      .getByLabel(ar ? "النقد المعدود بالدرهم" : "Espèces comptées (MAD)")
      .fill(ar ? "٣٣٠" : "330");
    await panel(page)
      .getByRole("button", { name: ar ? "إغلاق صندوقي" : "Clôturer ma caisse", exact: true })
      .click();
    await expect(
      panel(page).getByRole("heading", {
        name: ar ? "فتح صندوقي" : "Ouvrir ma caisse",
        exact: true,
      }),
    ).toBeVisible();
    expect(f.sessions.get(sessionId).closing.differenceCents).toBe(0);
    expect(f.attempts.size).toBe(2);
    expect(f.receipts.size).toBe(1);
    await page.goto("/admin/pos/session/" + sessionId);
    await expect(
      page.getByRole("article", { name: ar ? "ملخص الصندوق" : "Récapitulatif de caisse" }),
    ).toContainText("330");
    await page.emulateMedia({ media: "print" });
    await expect(
      page.getByRole("button", { name: ar ? "طباعة / PDF" : "Imprimer / PDF" }),
    ).toBeHidden();
    await page.screenshot({ path: info.outputPath("cash-closing-print.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      localStorage.removeItem("adminToken");
      window.dispatchEvent(new Event("storage"));
    });
    await expect(page.getByRole("article")).toHaveCount(0);
  });

test("A changed balance requires a new count and discrepancy note before closing", async ({
  page,
}) => {
  const f = await cashFixture(page);
  await page.goto("/admin?tab=pos");
  await openRegister(page);
  await panel(page).getByRole("button", { name: "Préparer la clôture" }).click();
  await panel(page).getByLabel("Espèces comptées (MAD)").fill("100");
  const sessionId = [...f.sessions.keys()][0];
  f.receipts.set("another-device", {
    id: "a".repeat(24),
    cashSessionId: sessionId,
    paymentMethod: "CASH",
    totalCents: 23000,
  });
  await panel(page).getByRole("button", { name: "Clôturer ma caisse", exact: true }).click();
  await expect(
    panel(page).getByRole("alert").filter({ hasText: "Des ventes ont été ajoutées" }).first(),
  ).toBeVisible();
  expect(f.sessions.get(sessionId).closing).toBeNull();
  await panel(page).getByRole("button", { name: "Actualiser le comptage" }).click();
  await expect(panel(page).getByLabel("Espèces comptées (MAD)")).toHaveValue("");
  await panel(page).getByLabel("Espèces comptées (MAD)").fill("320");
  await panel(page).getByLabel("Note de clôture").fill("Écart déclaré");
  await panel(page).getByRole("button", { name: "Clôturer ma caisse", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Ouvrir ma caisse", exact: true }),
  ).toBeVisible();
  expect(f.sessions.get(sessionId).closing.differenceCents).toBe(-1000);
  expect(sales(f)).toHaveLength(0);
});

test("A lost closing response persists across reload, recovers by reading and never opens a second session", async ({
  page,
}) => {
  const f = await cashFixture(page);
  await page.goto("/admin?tab=pos");
  await openRegister(page);
  await panel(page).getByRole("button", { name: "Préparer la clôture" }).click();
  await panel(page).getByLabel("Espèces comptées (MAD)").fill("100");
  f.cashState.closeOffline = true;
  f.cashState.recoveryOffline = true;
  await panel(page).getByRole("button", { name: "Clôturer ma caisse", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Opération de caisse à vérifier", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator(".pos-view-switch")
    .getByRole("button", { name: "Ma caisse", exact: true })
    .click();
  await expect(
    panel(page).getByRole("button", { name: "Ouvrir ma caisse", exact: true }),
  ).toBeDisabled();
  f.cashState.recoveryOffline = false;
  await panel(page).getByRole("button", { name: "Vérifier l’opération", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Opération de caisse à vérifier", exact: true }),
  ).toHaveCount(0);
  expect(
    f.calls.filter((c) => c.path.endsWith("/cash-sessions/close") && c.method === "POST"),
  ).toHaveLength(1);
  expect(f.sessions.size).toBe(1);
  expect(f.attempts.size).toBe(2);
});

test("Retry after an interrupted closing retains the original key and counted amount", async ({
  page,
}) => {
  const f = await cashFixture(page);
  await page.goto("/admin?tab=pos");
  await openRegister(page);
  await panel(page).getByRole("button", { name: "Préparer la clôture" }).click();
  await panel(page).getByLabel("Espèces comptées (MAD)").fill("100");
  f.cashState.closeBeforeCommit = true;
  await panel(page).getByRole("button", { name: "Clôturer ma caisse", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Opération de caisse à vérifier", exact: true }),
  ).toBeVisible();
  f.cashState.closeBeforeCommit = false;
  await panel(page).getByRole("button", { name: "Réessayer la même opération" }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Ouvrir ma caisse", exact: true }),
  ).toBeVisible();
  const calls = f.calls.filter(
    (c) => c.path.endsWith("/cash-sessions/close") && c.method === "POST",
  );
  expect(calls).toHaveLength(2);
  expect(calls[0].key).toBe(calls[1].key);
  expect(calls[0].body).toEqual(calls[1].body);
  expect(f.attempts.size).toBe(2);
});

test("A cart awaiting settlement blocks closing, and read-only users cannot operate a register", async ({
  page,
}) => {
  const f = await cashFixture(page);
  await page.goto("/admin?tab=pos");
  await openRegister(page);
  await page.getByRole("button", { name: "Encaisser", exact: true }).click();
  await add(page).click();
  await page
    .locator(".pos-view-switch")
    .getByRole("button", { name: "Ma caisse", exact: true })
    .click();
  await panel(page).getByRole("button", { name: "Préparer la clôture" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("Terminez ou videz le panier");
  expect(
    f.calls.filter((c) => c.path.endsWith("/cash-sessions/close") && c.method === "POST"),
  ).toHaveLength(0);
});
test("Cash reports remain accessible to a supervisor without exposing opening or closing actions", async ({
  page,
}) => {
  const f = await cashFixture(page, "fr", ["pos.read"]);
  await page.goto("/admin?tab=pos");
  await page.getByRole("button", { name: "Sessions de caisse", exact: true }).click();
  await expect(
    panel(page).getByRole("heading", { name: "Sessions de caisse", exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("button", { name: "Ouvrir ma caisse", exact: true }),
  ).toHaveCount(0);
  expect(f.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
});
