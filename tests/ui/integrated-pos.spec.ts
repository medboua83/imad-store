import { test, expect, type Page } from "@playwright/test";
const actor = "123456789012345678901234",
  v1 = "333333333333333333333331",
  v2 = "333333333333333333333332",
  pid = "222222222222222222222222";
const token = (permissions = ["pos.sell"], role = "STAFF") =>
  "fixture." +
  Buffer.from(JSON.stringify({ id: actor, role, permissions })).toString("base64url") +
  ".fixture";
async function fixture(page: Page, permissions = ["pos.sell"], locale = "fr") {
  const calls: { path: string; method: string; body: any; key: string | undefined }[] = [],
    receipts = new Map<string, any>();
  const state = { networkAfterCommit: false, failPrice: false, delay: 0, scanDelay: 0 };
  const variants = [
    {
      id: v1,
      productId: pid,
      sku: "TEST-NOIR-M",
      nameFr: "Abaya test",
      nameAr: "عباية تجريبية",
      size: "M",
      colorFr: "Noir",
      colorAr: "أسود",
      stock: 5,
      available: true,
      unitPriceCents: 23000,
      image: "/images/catalogue-test/abaya.webp",
    },
    {
      id: v2,
      productId: pid,
      sku: "TEST-MARRON-L",
      nameFr: "Abaya test",
      nameAr: "عباية تجريبية",
      size: "L",
      colorFr: "Marron",
      colorAr: "بني",
      stock: 0,
      available: false,
      unitPriceCents: 23000,
      image: "/images/catalogue-test/abaya.webp",
    },
  ];
  await page.addInitScript(
    ({ token, locale }) => {
      localStorage.setItem("adminToken", token);
      localStorage.setItem("imad-admin-language", locale);
    },
    { token: token(permissions), locale },
  );
  const quote = (items: any[]) => {
    const lines = items.map((i) => {
      const v = variants.find((v) => v.id === i.variantId)!;
      return {
        ...i,
        productId: pid,
        sku: v.sku,
        nameFr: v.nameFr,
        nameAr: v.nameAr,
        colorFr: v.colorFr,
        colorAr: v.colorAr,
        size: v.size,
        unitPriceCents: 23000,
        totalCents: Math.floor(i.quantity / 2) * 40000 + (i.quantity % 2) * 23000,
      };
    });
    const totalCents = lines.reduce((s, i) => s + i.totalCents, 0);
    return {
      currency: "MAD",
      quoteHash: "a".repeat(64),
      lines,
      totalCents,
      savingsCents: items.reduce((s, i) => s + i.quantity * 23000, 0) - totalCents,
    };
  };
  await page.context().route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method(),
      body = method === "GET" ? null : req.postDataJSON(),
      key = req.headers()["idempotency-key"];
    calls.push({ path, method, body, key });
    if (path === "/api/pos/context")
      return route.fulfill({
        json: {
          success: true,
          data: {
            actorId: actor,
            canSell: permissions.includes("pos.sell"),
            canReadAll: permissions.includes("pos.read"),
          },
        },
      });
    if (path === "/api/pos/scan") {
      if (state.scanDelay) await new Promise((r) => setTimeout(r, state.scanDelay));
      const data = variants.find((v) => v.sku === url.searchParams.get("sku"));
      try {
        return await route.fulfill({
          status: data ? 200 : 404,
          json: data ? { success: true, data } : { error: "Référence introuvable." },
        });
      } catch {
        return;
      }
    }
    if (path === "/api/pos/catalog") {
      const s = url.searchParams.get("search")?.toLowerCase();
      const data = s
        ? variants.filter((v) =>
            [v.sku, v.nameFr, v.nameAr].some((x) => x.toLowerCase().includes(s)),
          )
        : variants;
      return route.fulfill({
        json: { success: true, data, total: data.length, page: 1, totalPages: 1 },
      });
    }
    if (path === "/api/pos/quote")
      return route.fulfill({ json: { success: true, data: quote(body.items) } });
    if (path === "/api/pos/sales" && method === "POST") {
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      if (state.failPrice)
        return route.fulfill({
          status: 409,
          json: { error: "Les prix ou les articles ont changé. Vérifiez à nouveau le panier." },
        });
      const q = quote(body.items);
      let sale = receipts.get(key!);
      if (!sale) {
        sale = {
          id: "abcdefabcdefabcdefabcde" + (receipts.size + 1).toString(16),
          reference: "POS-ABCDEFABCDEFABCDEFABCDE" + (receipts.size + 1).toString(16),
          currency: "MAD",
          cashierId: actor,
          cashierName: "Caissier Test",
          createdAt: "2026-11-23T10:00:00Z",
          paymentMethod: body.paymentMethod,
          receivedCents: body.receivedCents,
          changeCents: body.receivedCents - q.totalCents,
          totalCents: q.totalCents,
          savingsCents: q.savingsCents,
          items: q.lines,
        };
        receipts.set(key!, sale);
      }
      if (state.networkAfterCommit) return route.abort("failed");
      return route.fulfill({ status: 201, json: { success: true, data: sale } });
    }
    if (path.startsWith("/api/pos/sales/by-key/")) {
      const sale = receipts.get(decodeURIComponent(path.split("/").at(-1)!));
      return route.fulfill({
        status: sale ? 200 : 404,
        json: sale ? { success: true, data: sale } : { error: "Absent" },
      });
    }
    if (path === "/api/pos/sales")
      return route.fulfill({
        json: {
          success: true,
          data: [...receipts.values()],
          total: receipts.size,
          page: 1,
          totalPages: 1,
          cashiers: [{ id: actor, name: "Caissier Test" }],
          scope: permissions.includes("pos.read") ? "ALL" : "OWN",
          today: {
            count: receipts.size,
            totalCents: [...receipts.values()].reduce((s, r) => s + r.totalCents, 0),
          },
        },
      });
    if (path.startsWith("/api/pos/sales/")) {
      const sale = [...receipts.values()].find((s) => s.id === path.split("/").at(-1));
      return route.fulfill({
        status: sale ? 200 : 404,
        json: sale ? { success: true, data: sale } : { error: "Absent" },
      });
    }
    return route.fulfill({
      json: { success: true, data: [], total: 0, unread: 0, page: 1, totalPages: 0 },
    });
  });
  page.on("dialog", (d) => d.accept());
  return { calls, receipts, state };
}
const cart = (page: Page) => page.getByRole("complementary", { name: "Panier de caisse" });
const add = (page: Page) =>
  page.getByRole("button", { name: "Ajouter Abaya test · Noir · M", exact: true });
const sales = (f: Awaited<ReturnType<typeof fixture>>) =>
  f.calls.filter((c) => c.path === "/api/pos/sales" && c.method === "POST");

for (const width of [320, 390, 1440])
  test(`Cash checkout, shared variant stock, immutable printable receipt and cashier history at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page);
    await page.goto("/admin?tab=pos");
    await expect(page.getByRole("heading", { name: "Votre caisse, simplement" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ajouter Abaya test · Marron · L", exact: true }),
    ).toBeDisabled();
    await add(page).click();
    await add(page).click();
    await expect(cart(page).locator(".pos-cart-total")).toContainText("400,00");
    await expect(cart(page).locator(".pos-cart-total")).toContainText("60,00");
    await cart(page).getByLabel("Montant reçu (MAD)").fill("500");
    f.state.delay = 150;
    await cart(page).getByRole("button", { name: "Valider l’encaissement" }).dblclick();
    await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
    expect(sales(f)).toHaveLength(1);
    await expect(page.getByRole("article", { name: "Ticket de caisse" })).toContainText("100,00");
    await page.screenshot({ path: info.outputPath("pos-cash-ticket.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Historique magasin" }).click();
    await expect(page.getByText("Caissier Test ·", { exact: false })).toBeVisible();
    await expect(page.getByText("Vous consultez uniquement vos encaissements.")).toBeVisible();
    await page.goto("/admin/pos/receipt/abcdefabcdefabcdefabcde1");
    await expect(page.getByRole("article", { name: "Ticket de caisse" })).toContainText(
      "IMAD MODE",
    );
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Imprimer / PDF" })).toBeHidden();
    await page.screenshot({ path: info.outputPath("pos-print.png"), fullPage: true });
    expect(sales(f)).toHaveLength(1);
    await page.evaluate(() => {
      localStorage.removeItem("adminToken");
      window.dispatchEvent(new Event("storage"));
    });
    await expect(page.getByRole("article", { name: "Ticket de caisse" })).toHaveCount(0);
    await expect(page.locator(".pos-print-page [role=alert]")).toContainText("Connectez-vous");
  });

test("An uncertain response freezes the saved attempt and reload recovery only reads the original receipt", async ({
  page,
}) => {
  const f = await fixture(page);
  f.state.networkAfterCommit = true;
  await page.goto("/admin?tab=pos");
  await add(page).click();
  await cart(page).getByLabel("Montant reçu (MAD)").fill("230");
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(page.getByRole("heading", { name: "Encaissement à vérifier" })).toBeVisible();
  const key = sales(f)[0].key;
  expect(key).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Encaissement à vérifier" })).toBeVisible();
  expect(sales(f)).toHaveLength(1);
  await page.getByRole("button", { name: "Vérifier cet encaissement" }).click();
  await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
  expect(sales(f)).toHaveLength(1);
  expect(f.calls.some((c) => c.path.endsWith("/by-key/" + key))).toBe(true);
});

test("Explicit retry retains the original idempotency key and body", async ({ page }) => {
  const f = await fixture(page);
  f.state.networkAfterCommit = true;
  await page.goto("/admin?tab=pos");
  await add(page).click();
  await cart(page).getByLabel("Montant reçu (MAD)").fill("240");
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(page.getByRole("heading", { name: "Encaissement à vérifier" })).toBeVisible();
  f.state.networkAfterCommit = false;
  await page.getByRole("button", { name: "Réessayer le même encaissement" }).click();
  await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
  expect(sales(f)).toHaveLength(2);
  expect(sales(f)[1]).toEqual(sales(f)[0]);
  expect(f.receipts.size).toBe(1);
});

test("Rejected prices preserve the cart and a full browser prevents sending an unrecoverable sale", async ({
  page,
}) => {
  const f = await fixture(page);
  f.state.failPrice = true;
  await page.goto("/admin?tab=pos");
  await add(page).click();
  await cart(page).getByLabel("Montant reçu (MAD)").fill("230");
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Les prix" })).toContainText("Les prix");
  await expect(cart(page)).toContainText("Abaya test");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("imad-pos-v1:" + "123456789012345678901234")!).pending,
    ),
  ).toBeNull();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.startsWith("imad-pos-v1:") && JSON.parse(v).pending)
        throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, k, v);
    };
  });
  f.state.failPrice = false;
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Impossible de conserver" }),
  ).toContainText("Impossible de conserver");
  expect(sales(f)).toHaveLength(1);
});

test("SKU scan chooses a precise variant and card mode explicitly records an already completed external payment", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const f = await fixture(page);
  await page.goto("/admin?tab=pos");
  await page.getByLabel("Nom ou référence SKU").fill("TEST-NOIR-M");
  await page.getByLabel("Nom ou référence SKU").press("Enter");
  await expect(cart(page)).toContainText("Abaya test");
  await cart(page).getByLabel("Mode de paiement").selectOption("CARD_TERMINAL");
  await expect(cart(page)).toContainText("La caisse ne débite aucune carte.");
  await expect(cart(page).getByLabel("Montant reçu (MAD)")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("pos-mobile-card.png"), fullPage: true });
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
  expect(sales(f)[0].body.paymentMethod).toBe("CARD_TERMINAL");
  expect(sales(f)[0].body.receivedCents).toBe(23000);
  expect(f.calls.some((c) => c.path.startsWith("/api/payments"))).toBe(false);
});

for (const width of [390, 1440])
  test(`Arabic POS and permission-limited sales history at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page, ["pos.read"], "ar");
    await page.goto("/admin?tab=pos");
    await expect(page.getByRole("heading", { name: "مبيعات المتجر", exact: true })).toBeVisible();
    await expect(page.getByText("لا توجد مبيعات في هذا العرض.")).toBeVisible();
    await expect(page.getByRole("button", { name: "تسجيل بيع", exact: true })).toHaveCount(0);
    expect(f.calls.some((c) => c.method === "POST")).toBe(false);
    expect(f.calls.some((c) => c.path === "/api/pos/catalog")).toBe(false);
    await page.screenshot({ path: info.outputPath("pos-arabic-history.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test("Another open cashier tab receives the frozen attempt instead of submitting a second sale", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/admin?tab=pos");
  await add(page).click();
  const other = await page.context().newPage();
  await other.goto("/admin?tab=pos");
  await cart(other).getByLabel("Montant reçu (MAD)").fill("230");
  await cart(page).getByLabel("Montant reçu (MAD)").fill("230");
  f.state.delay = 500;
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(other.locator(".pos-success,.pos-pending")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
  expect(sales(f)).toHaveLength(1);
});

for (const width of [390, 1440])
  test(`Arabic cash workspace is readable and touch-friendly at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page, ["pos.sell"], "ar");
    await page.goto("/admin?tab=pos");
    await expect(page.getByRole("heading", { name: "نقطة البيع بكل سهولة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "بحث", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "إضافة عباية تجريبية · أسود · M", exact: true }).click();
    await page.getByLabel("المبلغ المستلم بالدرهم").fill("250");
    await page.screenshot({ path: info.outputPath("pos-arabic-cash.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "تأكيد تسجيل الأداء", exact: true }).click();
    await expect(page.getByRole("heading", { name: "تم تسجيل الأداء" })).toBeVisible();
    expect(sales(f)).toHaveLength(1);
    await expect(page.locator(".pos-ticket")).toHaveAttribute("dir", "rtl");
    await page.goto("/admin/pos/receipt/abcdefabcdefabcdefabcde1");
    await expect(page.locator(".pos-print-page")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".pos-ticket")).toHaveAttribute("dir", "rtl");
  });

test("A slow scan cannot add an old reference or erase the next search", async ({ page }) => {
  const f = await fixture(page);
  f.state.scanDelay = 500;
  await page.goto("/admin?tab=pos");
  const search = page.getByLabel("Nom ou référence SKU");
  await search.fill("TEST-NOIR-M");
  await search.press("Enter");
  await expect.poll(() => f.calls.filter((c) => c.path === "/api/pos/scan").length).toBe(1);
  await search.fill("Abaya");
  await page.waitForTimeout(600);
  await expect(search).toHaveValue("Abaya");
  await expect(cart(page)).toContainText("Ajoutez un article pour commencer.");
  expect(sales(f)).toHaveLength(0);
});
test("A successful scan adds exactly one piece, but a stock-limited or unavailable reference never claims success", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/admin?tab=pos");
  const search = page.getByLabel("Nom ou référence SKU");
  for (let i = 0; i < 5; i++) await add(page).click();
  await expect(cart(page).locator(".pos-item-actions>span")).toHaveText("5");
  await search.fill("TEST-NOIR-M");
  await search.press("Enter");
  await expect(
    page.getByText("Quantité maximale disponible atteinte.", { exact: true }),
  ).toBeVisible();
  await expect(search).toHaveValue("TEST-NOIR-M");
  await search.fill("TEST-MARRON-L");
  await search.press("Enter");
  await expect(page.getByText("Cette référence est actuellement indisponible.")).toBeVisible();
  await expect(cart(page).locator(".pos-item-actions>span")).toHaveText("5");
  expect(sales(f)).toHaveLength(0);
});
test("A changed shared cart is reviewed before any payment is recorded", async ({ page }) => {
  const f = await fixture(page);
  await page.goto("/admin?tab=pos");
  await add(page).click();
  await cart(page).getByLabel("Montant reçu (MAD)").fill("500");
  await expect(cart(page).getByRole("button", { name: "Valider l’encaissement" })).toBeEnabled();
  await page.evaluate(() => {
    const key = "imad-pos-v1:123456789012345678901234",
      d = JSON.parse(localStorage.getItem(key)!);
    d.cart[0].quantity = 2;
    localStorage.setItem(key, JSON.stringify(d));
  });
  await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Le panier a changé" })).toBeVisible();
  await expect(cart(page).locator(".pos-cart-total")).toContainText("400,00");
  await expect(cart(page).getByLabel("Montant reçu (MAD)")).toHaveValue("");
  expect(sales(f)).toHaveLength(0);
});
for (const width of [390, 1440])
  test(`Two successive sales use distinct references and reset payment and search at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page);
    await page.goto("/admin?tab=pos");
    await page.getByLabel("Nom ou référence SKU").fill("Abaya");
    await add(page).click();
    await cart(page).getByLabel("Mode de paiement").selectOption("CARD_TERMINAL");
    await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
    await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
    await page.getByRole("button", { name: "Nouvelle vente", exact: true }).click();
    await expect(page.getByLabel("Nom ou référence SKU")).toHaveValue("");
    await add(page).click();
    await expect(cart(page).getByLabel("Mode de paiement")).toHaveValue("CASH");
    await cart(page).getByLabel("Montant reçu (MAD)").fill("٢٥٠٫٥٠");
    await expect(cart(page)).toContainText("20,50");
    await cart(page).getByRole("button", { name: "Valider l’encaissement" }).click();
    await expect(page.getByRole("heading", { name: "Vente encaissée" })).toBeVisible();
    expect(sales(f)).toHaveLength(2);
    expect(sales(f)[0].key).not.toBe(sales(f)[1].key);
    expect(sales(f)[1].body.receivedCents).toBe(25050);
    expect(sales(f)[1].body.paymentMethod).toBe("CASH");
    expect(f.receipts.size).toBe(2);
    await page.screenshot({ path: info.outputPath("successive-sales.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
