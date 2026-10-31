import { test, expect } from "@playwright/test";
const item = {
  productId: "222222222222222222222222",
  productSlug: "fixture-sabot",
  variantId: "333333333333333333333330",
  nameFr: "Sabot fictif",
  nameAr: "صابو تجريبي",
  nameEn: "Fixture clog",
  colorNameFr: "أسود",
  colorNameAr: "أسود",
  colorNameEn: "أسود",
  size: "40",
  price: 230,
  quantity: 1,
  stock: 2,
  image: "/images/catalogue-test/sac.webp",
  freeShipping: true,
};
for (const width of [320, 390, 1440]) {
  test(`Catalogue navigation keeps the product title below the header at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop");
    if (width === 1440) {
      const price = await page
        .locator(".catalog-card .product-current-price")
        .first()
        .boundingBox();
      expect(price!.y + price!.height).toBeLessThan(900);
    }
    await page.getByRole("link", { name: "عرض تفاصيل صابو تجريبي", exact: true }).click();
    await expect(page).toHaveURL(/\/products\/fixture-sabot$/);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const title = document.querySelector("h1")!.getBoundingClientRect();
          const header = document.querySelector("header")!.getBoundingClientRect();
          return title.top >= header.bottom && title.bottom < innerHeight;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`product-title-${width}.png`) });
    await page.getByRole("link", { name: "المتجر", exact: true }).first().click();
    await expect(page).toHaveURL(/\/shop$/);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "صابو تجريبي", exact: true })).toBeVisible();
  });
}
for (const saved of ["{broken", JSON.stringify({ state: { items: "bad" }, version: 0 })]) {
  test(`A damaged saved basket recovers instead of crashing (${saved.slice(0, 12)})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((value) => localStorage.setItem("imad-store-cart", value), saved);
    await page.goto("/checkout");
    await expect(page.locator("main .cart-recovery-notice")).toBeVisible();
    await expect(page.locator(".checkout-empty")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("A mixed saved basket preserves valid lines, gives a warning and survives reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((valid) => {
    if (!localStorage.getItem("imad-store-cart"))
      localStorage.setItem(
        "imad-store-cart",
        JSON.stringify({
          state: { items: [null, valid, { ...valid, quantity: "bad" }] },
          version: 0,
        }),
      );
  }, item);
  await page.goto("/checkout");
  await expect(page.locator("main .cart-recovery-notice")).toBeVisible();
  await expect(
    page.locator(".checkout-order-summary .bag-grand-total, .checkout-summary .bag-grand-total"),
  ).toContainText("230.00");
  await page.locator("main .cart-recovery-notice").getByRole("button").click();
  await expect(page.locator("main .cart-recovery-notice")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true })).toBeVisible();
  await expect(page.locator("main .cart-recovery-notice")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("recovered-checkout.png") });
  expect(errors).toEqual([]);
});
test("Browser storage being unavailable does not break a new basket", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/products/fixture-sabot");
  await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("230.00");
  expect(errors).toEqual([]);
});
for (const width of [390, 1440]) {
  test(`Merchant saves and reopens delivery and return commitments at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const settings: any = {
      shippingCost: 45,
      freeShippingMin: 500,
      codEnabled: true,
      metaPixelEnabled: false,
    };
    let writes = 0;
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-policy-test"));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      let data: any = [];
      if (url.pathname === "/api/settings") {
        if (route.request().method() === "PUT") {
          Object.assign(settings, route.request().postDataJSON());
          writes++;
        }
        data = settings;
      }
      await route.fulfill({ json: { success: true, data, total: 0, unread: 0 } });
    });
    await page.goto("/admin");
    if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("button", { name: "Paramètres", exact: true }).click();
    await page.getByLabel("Délai maximal de livraison (jours)", { exact: true }).fill("3");
    await page
      .getByLabel("Délai de demande de retour après réception (jours)", { exact: true })
      .fill("3");
    await page.getByLabel("Frais de retour à la charge de", { exact: true }).selectOption("DELIVERY_TRY_ON");
    await page.screenshot({ path: info.outputPath(`policy-settings-${width}.png`) });
    await page.getByRole("button", { name: "Enregistrer les réglages", exact: true }).click();
    await expect(page.getByText("Réglages enregistrés.", { exact: true })).toBeVisible();
    expect(settings).toMatchObject({
      deliveryMaxDays: 3,
      returnWindowDays: 3,
      returnFeePayer: "DELIVERY_TRY_ON",
      shippingCost: 45,
      freeShippingMin: 500,
    });
    await page.reload();
    if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
    await page.getByRole("button", { name: "Paramètres", exact: true }).click();
    await expect(
      page.getByLabel("Délai maximal de livraison (jours)", { exact: true }),
    ).toHaveValue("3");
    await expect(page.getByLabel("Frais de retour à la charge de", { exact: true })).toHaveValue(
      "DELIVERY_TRY_ON",
    );
    expect(writes).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
