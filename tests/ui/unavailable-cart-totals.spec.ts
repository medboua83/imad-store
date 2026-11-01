import { test, expect } from "@playwright/test";

const unavailable = {
  productId: "222222222222222222222222",
  productSlug: "fixture-sabot",
  variantId: "333333333333333333333330",
  nameAr: "صابو تجريبي",
  nameFr: "Sabot fictif",
  nameEn: "Fixture clog",
  price: 230,
  quantity: 1,
  stock: 2,
  colorNameAr: "أسود",
  colorNameFr: "أسود",
  colorNameEn: "أسود",
  size: "40",
  freeShipping: true,
  image: "/images/catalogue-test/sac.webp",
};
const available = {
  ...unavailable,
  productId: "555555555555555555555555",
  productSlug: "fixture-accessory",
  variantId: "555555555555555555555551",
  nameAr: "قطعة مكملة تجريبية",
  nameFr: "قطعة مكملة تجريبية",
  nameEn: "قطعة مكملة تجريبية",
  price: 50,
  quantity: 1,
  stock: 6,
  size: "M",
  freeShipping: false,
};
for (const width of [320, 390, 1440])
  for (const mixed of [false, true]) {
    test(`Unavailable ${mixed ? "mixed" : "entire"} basket never presents a payable total at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(
        (items) =>
          localStorage.setItem("imad-store-cart", JSON.stringify({ state: { items }, version: 0 })),
        mixed ? [unavailable, available] : [unavailable],
      );
      await page.route("**/api/products/fixture-sabot", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.data.variants = body.data.variants.map((v: { stock: number }) => ({ ...v, stock: 0 }));
        await route.fulfill({ response, json: body });
      });
      await page.route("**/api/products/fixture-accessory", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.data.freeShipping = false;
        await route.fulfill({ response, json: body });
      });
      let orders = 0;
      await page.route("**/api/orders", (route) => {
        orders++;
        return route.abort();
      });
      await page.goto("/checkout?stats_test=1");
      const review = page.getByRole("button", { name: "مراجعة الحقيبة", exact: true });
      await expect(review).toBeVisible();
      await expect(page.locator(".checkout-compact-total")).toContainText("راجعوا الحقيبة");
      await expect(page.locator(".checkout-compact-total")).not.toContainText("MAD");
      await expect(page.locator(".checkout-submit-bar strong")).toContainText("—");
      await expect(page.locator(".checkout-summary .bag-grand-total")).toContainText(
        "راجعوا الحقيبة",
      );
      await expect(page.getByRole("button", { name: "تأكيد الطلب", exact: true })).toBeDisabled();
      await review.click();
      const dialog = page.locator(".cart-dialog");
      await expect(dialog.locator(".bag-stock-error")).toContainText("غير متوفر");
      await expect(dialog.locator(".bag-grand-total")).toContainText("راجعوا الحقيبة");
      await expect(dialog.locator(".bag-grand-total")).not.toContainText("MAD");
      await expect(dialog.locator(".bag-totals")).toContainText("بعد مراجعة الحقيبة");
      await expect(
        dialog.getByRole("button", { name: "متابعة الطلب", exact: true }),
      ).toBeDisabled();
      await page.screenshot({
        path: info.outputPath(`unavailable-${mixed ? "mixed" : "entire"}-${width}.png`),
      });
      await dialog.getByRole("button", { name: "حذف صابو تجريبي", exact: true }).click();
      if (mixed) {
        await expect(dialog.locator(".bag-grand-total")).toContainText("95.00");
        await expect(dialog.getByRole("link", { name: "متابعة الطلب", exact: true })).toBeVisible();
      } else {
        await expect(dialog.locator(".bag-empty")).toBeVisible();
        await expect(dialog.locator(".bag-footer")).toHaveCount(0);
      }
      await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
      if (mixed) {
        await expect(page.locator(".checkout-compact-total")).toContainText("95.00");
        await expect(page.locator(".checkout-submit-bar strong")).toContainText("95.00");
        await expect(page.getByRole("button", { name: "تأكيد الطلب", exact: true })).toBeEnabled();
      } else await expect(page.locator(".checkout-empty")).toBeVisible();
      expect(orders).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
