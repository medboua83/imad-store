import { test, expect, type Page } from "@playwright/test";
import { fixture, actor, v1 } from "./fixtures/pos";
const sid = "a".repeat(24),
  saleId = "b".repeat(24),
  itemId = "c".repeat(24),
  rid = "d".repeat(24);
async function returnsFixture(page: Page, canReturn = true, locale = "fr") {
  const f = await fixture(page, canReturn ? ["pos.sell", "pos.returns"] : ["pos.read"], locale),
    receipts = new Map<string, any>();
  const calls: any[] = [],
    state = { lost: false, recoverFails: false, fail: false, quotes: 0 };
  const line = {
    id: itemId,
    productId: "222222222222222222222222",
    variantId: v1,
    sku: "TEST-NOIR-M",
    nameFr: "Abaya test",
    nameAr: "عباية تجريبية",
    size: "M",
    colorFr: "Noir",
    colorAr: "أسود",
    quantity: 2,
    unitPriceCents: 23000,
    totalCents: 40000,
    returnedQuantity: 0,
    refundedCents: 0,
    remainingQuantity: 2,
    canRestock: true,
  };
  await page.context().route("**/api/pos/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      body = req.method() === "GET" ? null : req.postDataJSON();
    if (path === "/api/pos/context")
      return route.fulfill({
        json: {
          success: true,
          data: { actorId: actor, canSell: canReturn, canReadAll: !canReturn, canReturn },
        },
      });
    if (path === "/api/pos/cash-sessions/context")
      return route.fulfill({
        json: {
          success: true,
          data: {
            enabled: true,
            active: {
              id: sid,
              openingCents: 100000,
              expectedCents: 100000,
              cashCents: 0,
              cashierId: actor,
              currency: "MAD",
              balanceHash: "b".repeat(64),
              closing: null,
            },
          },
        },
      });
    if (path === "/api/pos/returns/source")
      return route.fulfill({
        json: {
          success: true,
          data: {
            id: saleId,
            kind: "SALE",
            reference: "POS-" + saleId.toUpperCase(),
            rootSaleId: saleId,
            items: [line],
          },
        },
      });
    if (path === "/api/pos/returns/quote") {
      state.quotes++;
      const quantity = body.returns[0].quantity,
        returnCents = quantity * 20000,
        replacementCents = body.replacements.reduce(
          (n: number, i: any) => n + i.quantity * 23000,
          0,
        );
      return route.fulfill({
        json: {
          success: true,
          data: {
            currency: "MAD",
            quoteHash: "a".repeat(64),
            returnCents,
            replacementCents,
            netCents: replacementCents - returnCents,
            returns: [
              {
                ...line,
                sourceItemId: itemId,
                quantity,
                restock: body.returns[0].restock,
                totalCents: returnCents,
              },
            ],
            replacements: body.replacements.map((i: any) => ({
              ...line,
              ...i,
              totalCents: i.quantity * 23000,
            })),
          },
        },
      });
    }
    if (path === "/api/pos/returns" && req.method() === "POST") {
      const key = req.headers()["idempotency-key"]!;
      calls.push({ body, key });
      if (state.fail)
        return route.fulfill({
          status: 409,
          json: { error: "Le retour, les prix ou le stock ont changé. Vérifiez à nouveau." },
        });
      let r = receipts.get(key);
      if (!r) {
        const returnCents = body.returns[0].quantity * 20000,
          replacementCents = body.replacements.reduce(
            (n: number, i: any) => n + i.quantity * 23000,
            0,
          );
        r = {
          id: rid,
          reference: "RET-" + rid.toUpperCase(),
          currency: "MAD",
          rootSaleId: saleId,
          sourceSaleId: saleId,
          sourceAdjustmentId: null,
          cashierId: actor,
          cashierName: "Caissier fictif",
          cashSessionId: sid,
          returnCents,
          replacementCents,
          netCents: replacementCents - returnCents,
          paymentMethod: body.paymentMethod,
          receivedCents: body.receivedCents,
          changeCents:
            replacementCents > returnCents
              ? body.receivedCents - (replacementCents - returnCents)
              : 0,
          note: body.note,
          createdAt: new Date().toISOString(),
          items: [
            {
              ...line,
              id: "e".repeat(24),
              sourceItemId: itemId,
              quantity: body.returns[0].quantity,
              totalCents: returnCents,
              restock: body.returns[0].restock,
              kind: "RETURN",
            },
            ...body.replacements.map((i: any) => ({
              ...line,
              ...i,
              id: "f".repeat(24),
              kind: "REPLACEMENT",
              sourceItemId: null,
              restock: null,
              totalCents: i.quantity * 23000,
            })),
          ],
        };
        receipts.set(key, r);
      }
      if (state.lost) return route.abort("failed");
      return route.fulfill({ status: 201, json: { success: true, data: r } });
    }
    if (path.startsWith("/api/pos/returns/by-key/")) {
      if (state.recoverFails) return route.abort("failed");
      const r = receipts.get(path.split("/").pop()!);
      return route.fulfill({
        status: r ? 200 : 404,
        json: r ? { data: r } : { error: "Ce retour n’est pas encore enregistré." },
      });
    }
    if (path === "/api/pos/returns")
      return route.fulfill({
        json: {
          success: true,
          data: [...receipts.values()],
          total: receipts.size,
          totalPages: receipts.size ? 1 : 0,
          page: 1,
        },
      });
    if (path.startsWith("/api/pos/returns/")) {
      const r = [...receipts.values()].find((r) => r.id === path.split("/").pop());
      return route.fulfill({ status: r ? 200 : 404, json: { data: r } });
    }
    return route.fallback();
  });
  await page.goto("/admin?tab=pos");
  await page
    .locator(".pos-view-switch")
    .getByRole("button", {
      name: locale === "ar" ? "المرتجعات والاستبدال" : "Retours et échanges",
      exact: true,
    })
    .tap();
  return { f, state, calls, receipts };
}
async function choose(page: Page, restock = "yes") {
  await page.getByLabel("Ticket d’origine", { exact: true }).fill("POS-" + saleId.toUpperCase());
  await page.getByRole("button", { name: "Retrouver le ticket", exact: true }).tap();
  await page.getByLabel("Quantité à retourner — TEST-NOIR-M", { exact: true }).selectOption("1");
  if (restock)
    await page.getByLabel("État de l’article — TEST-NOIR-M", { exact: true }).selectOption(restock);
  await page.getByLabel("Motif du retour", { exact: true }).fill("Essai fictif isolé");
}
async function review(page: Page) {
  await page.getByRole("button", { name: "Vérifier le total du retour", exact: true }).tap();
  await expect(page.getByRole("region", { name: "Vérification du retour" })).toBeVisible();
}
for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
]) {
  test.describe(`Returns touch layout ${viewport.width}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });
    test("Refund requires an explicit condition and records the original discounted price once", async ({
      page,
    }) => {
      const f = await returnsFixture(page);
      await choose(page, "");
      await page.getByRole("button", { name: "Vérifier le total du retour", exact: true }).tap();
      await expect(page.locator(".pos-returns").getByRole("alert")).toContainText(
        "Indiquez si chaque article",
      );
      expect(f.state.quotes).toBe(0);
      await page.getByLabel("État de l’article — TEST-NOIR-M", { exact: true }).selectOption("yes");
      await review(page);
      await expect(page.getByRole("region", { name: "Vérification du retour" })).toContainText(
        "200,00",
      );
      await page
        .getByRole("button", { name: "Enregistrer le retour ou l’échange", exact: true })
        .tap();
      await expect(
        page.getByRole("heading", { name: "Retour enregistré", exact: true }),
      ).toBeVisible();
      expect(f.calls).toHaveLength(1);
      expect(f.calls[0].body.returns[0].restock).toBe(true);
      expect(f.calls[0].body.receivedCents).toBe(0);
      await expect(page.getByRole("article", { name: "Reçu de retour ou échange" })).toContainText(
        "Remis en stock",
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
    test("Exchange exposes only the cash difference and leaves unsellable goods out of stock", async ({
      page,
    }) => {
      const f = await returnsFixture(page);
      await choose(page, "no");
      await page.getByText("Ajouter des articles pour un échange", { exact: true }).tap();
      await page.locator(".pos-return-options").getByRole("button").first().tap();
      await review(page);
      await expect(page.getByRole("region", { name: "Vérification du retour" })).toContainText(
        "30,00",
      );
      await page.getByLabel("Espèces reçues (MAD)", { exact: true }).fill("50");
      await page
        .getByRole("button", { name: "Enregistrer le retour ou l’échange", exact: true })
        .tap();
      await expect(
        page.getByRole("heading", { name: "Échange enregistré", exact: true }),
      ).toBeVisible();
      expect(f.calls[0].body.receivedCents).toBe(5000);
      expect(f.calls[0].body.returns[0].restock).toBe(false);
      await expect(page.getByRole("article", { name: "Reçu de retour ou échange" })).toContainText(
        "20,00",
      );
    });
    test("Lost response and reload recover the same receipt without a second refund", async ({
      page,
    }) => {
      const f = await returnsFixture(page);
      f.state.lost = true;
      f.state.recoverFails = true;
      await choose(page);
      await review(page);
      await page
        .getByRole("button", { name: "Enregistrer le retour ou l’échange", exact: true })
        .tap();
      await expect(page.getByRole("heading", { name: "Retour à vérifier" })).toBeVisible();
      await page.reload();
      await page
        .locator(".pos-view-switch")
        .getByRole("button", { name: "Retours et échanges", exact: true })
        .tap();
      f.state.recoverFails = false;
      await page.getByRole("button", { name: "Vérifier le retour", exact: true }).tap();
      await expect(
        page.getByRole("heading", { name: "Retour enregistré", exact: true }),
      ).toBeVisible();
      expect(f.calls).toHaveLength(1);
      expect(f.receipts.size).toBe(1);
    });
    test("Arabic and read-only access keep the layout usable without refund controls", async ({
      page,
    }) => {
      const f = await returnsFixture(page, false, "ar");
      await expect(
        page.getByRole("heading", { name: "المرتجعات والاستبدال", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "تسجيل الإرجاع أو الاستبدال" })).toHaveCount(0);
      expect(f.calls).toHaveLength(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  });
}
