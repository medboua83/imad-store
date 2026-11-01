import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Delivery benefit follows offers, eligible items and threshold at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    let orders = 0;
    await page.route("**/api/orders", (route) => {
      orders++;
      return route.abort();
    });
    await page.goto("/products/fixture-paid-shipping?stats_test=1");
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const dialog = page.locator(".cart-dialog");
    const benefit = dialog.getByRole("status", { name: "حالة التوصيل", exact: true });
    await expect(dialog.locator(".bag-grand-total")).toContainText("445.00");
    await expect(benefit).toContainText("100.00 MAD");
    await expect(benefit.getByRole("progressbar")).toHaveAttribute("value", "400");
    await expect(benefit.getByRole("progressbar")).toHaveAttribute("max", "500");
    await page.screenshot({ path: info.outputPath(`delivery-progress-${width}.png`) });
    await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
    await page.goto("/products/fixture-accessory?stats_test=1");
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    await expect(dialog.locator(".bag-grand-total")).toContainText("450.00");
    await expect(benefit).toContainText("التوصيل مجاني لطلبكم");
    await expect(benefit.getByRole("progressbar")).toHaveCount(0);
    await dialog.getByRole("button", { name: "حذف قطعة مكملة تجريبية", exact: true }).click();
    await expect(benefit).toContainText("100.00 MAD");
    await expect(dialog.locator(".bag-grand-total")).toContainText("445.00");
    await dialog.getByRole("button", { name: "زيادة كمية صابو تجريبي", exact: true }).click();
    await expect(dialog.locator(".bag-grand-total")).toContainText("630.00");
    await expect(benefit).toContainText("التوصيل مجاني لطلبكم");
    await expect(benefit.getByRole("progressbar")).toHaveCount(0);
    await dialog.getByRole("link", { name: "متابعة الطلب", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout/);
    const summary = page.locator(".checkout-summary");
    if (width < 768) await page.locator(".checkout-order-disclosure > summary").click();
    const summaryBenefit = summary.getByRole("status", { name: "حالة التوصيل", exact: true });
    await expect(summaryBenefit).toContainText("التوصيل مجاني لطلبكم");
    await page.locator(".checkout-item-disclosure > summary").click();
    await summary.getByRole("button", { name: "تقليل كمية صابو تجريبي", exact: true }).click();
    await expect(summaryBenefit).toContainText("100.00 MAD");
    await expect(summary.locator(".bag-grand-total")).toContainText("445.00");
    let threshold = 400.01;
    await page.route("**/api/settings", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.freeShippingMin = threshold;
      await route.fulfill({ response, json: body });
    });
    await page.reload();
    if (width < 768) await page.locator(".checkout-order-disclosure > summary").click();
    await expect(summaryBenefit).toContainText("0.01 MAD");
    threshold = 400;
    await page.reload();
    if (width < 768) await page.locator(".checkout-order-disclosure > summary").click();
    await expect(summaryBenefit).toContainText("التوصيل مجاني لطلبكم");
    await expect(summary.locator(".bag-grand-total")).toContainText("400.00");
    expect(orders).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Delivery benefit waits for a valid basket and delivery settings at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      if (!localStorage.getItem("imad-store-cart"))
        localStorage.setItem(
          "imad-store-cart",
          JSON.stringify({
            state: {
              items: [
                {
                  productId: "222222222222222222222222",
                  productSlug: "fixture-sabot",
                  variantId: "333333333333333333333331",
                  nameAr: "صابو تجريبي",
                  nameFr: "Sabot fictif",
                  nameEn: "Fixture clog",
                  price: 230,
                  quantity: 1,
                  stock: 0,
                  colorNameAr: "أسود",
                  colorNameFr: "أسود",
                  colorNameEn: "أسود",
                  size: "44",
                  freeShipping: true,
                  image: "/images/catalogue-test/sac.webp",
                },
              ],
            },
            version: 0,
          }),
        );
    });
    let orders = 0;
    await page.route("**/api/orders", (route) => {
      orders++;
      return route.abort();
    });
    await page.goto("/checkout?stats_test=1");
    await expect(page.getByRole("button", { name: "مراجعة الحقيبة", exact: true })).toBeVisible();
    await expect(page.locator(".checkout-summary .store-delivery-benefit")).toHaveCount(0);
    await page.getByRole("button", { name: "مراجعة الحقيبة", exact: true }).click();
    const dialog = page.locator(".cart-dialog");
    await expect(dialog.locator(".bag-grand-total")).toContainText("راجعوا الحقيبة");
    await expect(dialog.locator(".store-delivery-benefit")).toHaveCount(0);
    await dialog.getByRole("button", { name: "حذف صابو تجريبي", exact: true }).click();
    await expect(dialog.locator(".store-delivery-benefit")).toHaveCount(0);
    await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
    await page.route("**/api/settings", (route) => route.abort());
    await page.goto("/products/fixture-manual?stats_test=1");
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    await expect(dialog.locator(".bag-footer")).toContainText("تعذر تحميل رسوم التوصيل");
    await expect(dialog.locator(".store-delivery-benefit")).toHaveCount(0);
    await page.unroute("**/api/settings");
    await dialog.getByRole("button", { name: "إعادة المحاولة", exact: true }).click();
    await expect(dialog.getByRole("status", { name: "حالة التوصيل", exact: true })).toContainText(
      "التوصيل مجاني لطلبكم",
    );
    await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
    await page.screenshot({ path: info.outputPath(`delivery-free-${width}.png`) });
    await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
    await page.route("**/api/settings", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.codEnabled = false;
      await route.fulfill({ response, json: body });
    });
    await page.reload();
    await page.locator(".site-header .cart-toggle").click();
    await expect(dialog).toContainText("الطلب بالدفع عند الاستلام متوقف مؤقتاً");
    await expect(dialog.locator(".store-delivery-benefit")).toHaveCount(0);
    expect(orders).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
