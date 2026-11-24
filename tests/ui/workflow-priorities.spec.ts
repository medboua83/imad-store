import { test, expect, type Page } from "@playwright/test";
import { chooseSizeIfRequired } from "./choose-size";

const id = "222222222222222222222222";
async function adminFixture(page: Page, ar = false) {
  const category = {
    id: "111111111111111111111111",
    slug: "fixture",
    nameFr: "Recette",
    nameAr: "تجربة",
    nameEn: "Fixture",
  };
  let product = {
    id,
    slug: "workflow-fixture",
    category,
    status: "ACTIVE",
    nameFr: "Article de recette",
    nameAr: "منتج تجريبي",
    nameEn: "Fixture product",
    descriptionFr: "Description",
    descriptionAr: "وصف",
    descriptionEn: "Description",
    price: 230,
    images: ["/images/catalogue-test/abaya.webp"],
    quantityDiscounts: [],
    variants: Array.from({ length: 15 }, (_, n) => ({
      id: (n + 100).toString(16).padStart(24, "0"),
      sku: `WORKFLOW-${n}`,
      size: `S${n + 1}`,
      color: "#000000",
      colorNameFr: "Noir",
      colorNameAr: "أسود",
      colorNameEn: "Black",
      stock: 7,
    })),
  };
  const writes: { path: string; body: any }[] = [];
  await page.addInitScript((ar) => {
    localStorage.setItem("adminToken", "isolated-workflow-test");
    localStorage.setItem("imad-admin-language", ar ? "ar" : "fr");
  }, ar);
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (req.method() !== "GET") {
      writes.push({ path, body: req.postDataJSON() });
      if (req.method() !== "PUT" || path !== `/api/products/${id}`)
        return route.fulfill({ status: 405 });
      product = { ...product, ...req.postDataJSON(), category };
      return route.fulfill({ json: { success: true, data: product } });
    }
    if (path === "/api/orders") {
      const data = url.searchParams.get("search")
        ? []
        : [
            {
              id: "444444444444444444444444",
              customerName: "TEST FICTIF",
              customerPhone: "+212600000000",
              city: "Rabat",
              status: "CONFIRMED",
              paymentMethod: "COD",
              paymentStatus: "PENDING",
              totalAmount: 230,
              createdAt: "2026-11-24T10:00:00Z",
              items: [],
            },
          ];
      return route.fulfill({
        json: {
          success: true,
          data,
          total: data.length,
          scopeTotal: data.length,
          page: 1,
          totalPages: data.length,
          statusCounts: { CONFIRMED: data.length },
          trackingFilter: url.searchParams.get("tracking") || "ALL",
        },
      });
    }
    if (path === "/api/orders/dispatch-blacklist")
      return route.fulfill({ json: { success: true, data: [], total: 0, page: 1, totalPages: 0 } });
    const data =
      path === "/api/categories"
        ? [category]
        : path === "/api/products/admin/catalog"
          ? [product]
          : [];
    return route.fulfill({
      json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 },
    });
  });
  return { writes, product: () => product };
}
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

for (const width of [320, 390, 1440])
  for (const ar of [false, true]) {
    test(`Editor sections, browser history and the original save action retain a long draft at ${width}px ${ar ? "AR" : "FR"}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      const f = await adminFixture(page, ar);
      await page.goto("/admin?tab=products");
      await page.getByRole("button", { name: /^(Modifier|تعديل) Article de recette$/ }).click();
      const targetName = page.getByLabel(ar ? "الاسم الفرنسي" : "Nom français", { exact: true });
      await targetName.fill("Saisie conservée");
      const nav = page.locator(".product-editor-nav");
      await nav.locator('a[href="#product-variants"]').click();
      const stock = page.locator("#product-variants");
      await expect(stock).toBeFocused();
      await expect.poll(async () => (await stock.boundingBox())!.y).toBeLessThan(200);
      const save = page.getByRole("button", {
        name: ar ? "حفظ المنتج" : "Enregistrer le produit",
        exact: true,
      });
      await expect(save).toBeInViewport({ ratio: 1 });
      if (width < 600)
        expect((await page.locator(".product-editor-footer").boundingBox())!.height).toBeLessThan(
          180,
        );
      await nav.locator('a[href="#product-photos"]').click();
      await expect(page.locator("#product-photos")).toBeFocused();
      await page.goBack();
      await expect(stock).toBeFocused();
      await page.goForward();
      await expect(page.locator("#product-photos")).toBeFocused();
      await expect(targetName).toHaveValue("Saisie conservée");
      expect(f.writes).toEqual([]);
      await save.click();
      await expect.poll(() => f.writes.length).toBe(1);
      expect(f.product().nameFr).toBe("Saisie conservée");
      expect(f.product().variants.map((x) => x.stock)).toEqual(Array(15).fill(7));
      expect(f.writes[0].path).toBe(`/api/products/${id}`);
      await page.screenshot({ path: info.outputPath("editor-saved.png") });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });

    test(`Order results stay near the search and tools remain usable at ${width}px ${ar ? "AR" : "FR"}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      const f = await adminFixture(page, ar);
      await page.goto("/admin?tab=orders");
      const card = page.locator(".admin-order-card");
      await expect(card).toBeVisible();
      await page.screenshot({ path: info.outputPath("orders-compact.png") });
      expect((await card.boundingBox())!.y).toBeLessThan(width < 768 ? 750 : 700);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath("orders-compact.png") });
      await page.locator(".dispatch-blacklist summary").click();
      await expect(page.locator(".dispatch-blacklist")).toContainText(
        ar ? "لا يوجد رقم مرتبط بطلب ملغى" : "Aucun numéro associé à une commande annulée",
      );
      await page.locator(".dispatch-blacklist summary").click();
      await page.locator(".admin-search input").fill("aucun");
      await expect(card).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: ar ? "إعادة ضبط الفلاتر" : "Réinitialiser les filtres",
          exact: true,
        }),
      ).toBeEnabled();
      expect(f.writes).toEqual([]);
    });
  }

for (const viewport of [
  { width: 390, height: 700 },
  { width: 400, height: 605 },
  { width: 1440, height: 900 },
]) {
  test(`The compact basket keeps line editing, totals and the full breakdown at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    let writes = 0;
    await page.route("**/api/orders", (route) => {
      writes++;
      return route.abort();
    });
    await page.goto("/products/fixture-manual?stats_test=1");
    await chooseSizeIfRequired(page);
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const checkout = dialog.getByRole("link", { name: "متابعة الطلب", exact: true });
    await expect(checkout).toBeEnabled();
    expect((await dialog.locator(".bag-footer").boundingBox())!.height).toBeLessThan(160);
    const increase = dialog.getByRole("button", { name: "زيادة كمية صابو تجريبي", exact: true });
    await expect(increase).toBeInViewport({ ratio: 1 });
    await increase.click();
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
    await dialog.locator(".bag-cost-breakdown summary").click();
    await expect(dialog.locator(".bag-breakdown-totals")).toBeVisible();
    await expect(dialog.locator(".bag-breakdown-totals")).toContainText("400.00");
    await expect(dialog.locator(".bag-grand-total")).toHaveCount(1);
    await page.screenshot({ path: info.outputPath("basket-compact.png") });
    expect(writes).toBe(0);
  });
}
