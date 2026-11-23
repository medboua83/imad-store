import { test, expect } from "@playwright/test";
import { actor, fixture, cart, add, sales } from "./fixtures/pos";

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

function seedHistory(f: Awaited<ReturnType<typeof fixture>>) {
  for (let i = 1; i <= 27; i++) {
    const id = i.toString(16).padStart(24, "a");
    f.receipts.set("history-" + i, {
      id,
      reference: "POS-" + id.toUpperCase(),
      cashierId: actor,
      cashierName: "Caissier Test",
      paymentMethod: i === 1 ? "CARD_TERMINAL" : "CASH",
      totalCents: 23000,
      createdAt: i === 1 ? "2026-11-22T10:00:00Z" : "2026-11-23T10:00:00Z",
    });
  }
  return "POS-" + [...f.receipts.values()][0].id.toUpperCase();
}
for (const [width, locale] of [
  [390, "fr"],
  [1440, "fr"],
  [320, "ar"],
] as const)
  test(`Receipt history combines dates and payment, resets pagination and displays the full reference at ${width}px ${locale}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page, ["pos.read"], locale),
      reference = seedHistory(f),
      ar = locale === "ar";
    await page.goto("/admin?tab=pos");
    const panel = page.locator(".pos-history");
    await expect(
      panel.getByRole("heading", { name: ar ? "مبيعات المتجر" : "Ventes magasin" }),
    ).toBeVisible();
    await expect(panel.locator(".pos-history-count")).toContainText("27");
    await panel.getByRole("button", { name: ar ? "الصفحة التالية" : "Page suivante" }).click();
    await expect(panel.locator(".pos-sales-list > li")).toHaveCount(2);
    const before = f.calls.filter((c) => c.path === "/api/pos/sales").length;
    await panel.getByLabel(ar ? "مرجع الإيصال" : "Référence du ticket").fill("#" + reference);
    await panel.getByLabel(ar ? "طريقة الأداء" : "Mode de paiement").selectOption("CARD_TERMINAL");
    await panel.getByLabel(ar ? "من" : "Du", { exact: true }).fill("2026-11-22");
    await panel.getByLabel(ar ? "إلى" : "Au", { exact: true }).fill("2026-11-22");
    expect(f.calls.filter((c) => c.path === "/api/pos/sales")).toHaveLength(before);
    await panel
      .getByRole("button", { name: ar ? "تطبيق عوامل التصفية" : "Appliquer les filtres" })
      .click();
    await expect(panel.locator(".pos-sales-list > li")).toHaveCount(1);
    await expect(panel.locator(".pos-history-reference")).toHaveText(reference);
    const last = new URL(f.calls.filter((c) => c.path === "/api/pos/sales").at(-1)!.url);
    expect(last.searchParams.get("page")).toBe("1");
    expect(last.searchParams.get("paymentMethod")).toBe("CARD_TERMINAL");
    expect(last.searchParams.get("from")).toBe("2026-11-22");
    await page.screenshot({ path: info.outputPath("history-filtered.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await panel
      .getByRole("button", { name: ar ? "إعادة ضبط الفلاتر" : "Réinitialiser les filtres" })
      .click();
    await expect(panel.locator(".pos-sales-list > li")).toHaveCount(25);
    await expect(panel.getByLabel(ar ? "مرجع الإيصال" : "Référence du ticket")).toHaveValue("");
    await expect(panel.getByLabel(ar ? "من" : "Du", { exact: true })).toHaveValue("");
    expect(f.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });

test("Invalid history periods preserve inputs and recovery retries only the applied filters", async ({
  page,
}) => {
  const f = await fixture(page, ["pos.sell"]);
  seedHistory(f);
  await page.goto("/admin?tab=pos");
  await page.getByRole("button", { name: "Historique magasin" }).click();
  const panel = page.locator(".pos-history");
  await expect(panel.getByLabel("Caissier", { exact: true })).toHaveCount(0);
  await expect(panel.locator(".pos-history-count")).toContainText("27");
  const count = f.calls.filter((c) => c.path === "/api/pos/sales").length;
  await panel.getByLabel("Du", { exact: true }).fill("2026-11-24");
  await panel.getByLabel("Au", { exact: true }).fill("2026-11-22");
  await panel.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(panel.getByRole("alert")).toContainText("La date de fin doit suivre");
  expect(f.calls.filter((c) => c.path === "/api/pos/sales")).toHaveLength(count);
  await panel.getByLabel("Du", { exact: true }).fill("2026-11-22");
  f.state.historyFailure = true;
  await panel.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(panel.getByRole("alert")).toContainText("Historique de caisse indisponible");
  await expect(panel.getByLabel("Du", { exact: true })).toHaveValue("2026-11-22");
  f.state.historyFailure = false;
  await panel.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect(panel.locator(".pos-sales-list > li")).toHaveCount(1);
  await expect(panel.getByText("Vous consultez uniquement vos encaissements.")).toBeVisible();
  expect(f.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
});
