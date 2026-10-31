import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`Manual quantity replacement and invalid drafts stay safe at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    let orders = 0;
    await page.route("**/api/orders", route => { orders++; return route.abort(); });
    await page.goto("/products/fixture-quantity-input?stats_test=1");
    const quantity = page.getByRole("spinbutton", { name: "الكمية", exact: true });
    const add = page.getByRole("button", { name: "إضافة إلى السلة", exact: true });
    const price = page.locator(".purchase-price");
    await quantity.fill("");
    await expect(quantity).toHaveValue("");
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(add).toBeDisabled();
    await expect(price).toContainText("—");
    await quantity.pressSequentially("12");
    await expect(quantity).toHaveValue("12");
    await expect(price).toContainText("2400.00");
    await expect(add).toBeEnabled();
    await quantity.press("Tab");
    await expect(quantity).toHaveValue("12");
    await quantity.focus();
    await quantity.press("ControlOrMeta+A");
    await quantity.press("Backspace");
    await expect(quantity).toHaveValue("");
    await quantity.pressSequentially("2");
    await expect(quantity).toHaveValue("2");
    await expect(price).toContainText("400.00");
    for (const invalid of ["21", "0", "1.5"]) {
      await quantity.fill(invalid);
      await expect(quantity).toHaveValue(invalid);
      await expect(quantity).toHaveAttribute("aria-invalid", "true");
      await expect(quantity).toHaveAttribute("aria-describedby", "product-quantity-error");
      await expect(page.locator("#product-quantity-error")).toContainText("20");
      await expect(add).toBeDisabled();
      await expect(price).toContainText("—");
      await quantity.press("Tab");
      await expect(quantity).toHaveValue(invalid);
    }
    await page.screenshot({ path: info.outputPath(`quantity-invalid-${width}.png`) });
    await page.getByRole("button", { name: "اختيار قطعة واحدة", exact: true }).click();
    await expect(quantity).toHaveValue("1");
    await expect(quantity).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("#product-quantity-error")).toHaveCount(0);
    await page.getByRole("button", { name: "زيادة الكمية", exact: true }).click();
    await expect(quantity).toHaveValue("2");
    await expect(price).toContainText("400.00");
    await page.getByRole("button", { name: "تقليل الكمية", exact: true }).click();
    await expect(quantity).toHaveValue("1");
    await quantity.fill("2");
    await add.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".bag-quantity span")).toHaveText("2");
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
    expect(orders).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [390, 1440]) {
  test(`Manual quantity respects reserved stock and variant changes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => localStorage.setItem("imad-store-cart", JSON.stringify({state:{items:[{
      productId:"222222222222222222222222",productSlug:"fixture-quantity-input",variantId:"333333333333333333333330",
      nameAr:"صابو تجريبي",nameFr:"Sabot fictif",nameEn:"Fixture clog",price:230,quantity:19,stock:20,
      colorNameAr:"أسود",colorNameFr:"أسود",colorNameEn:"أسود",size:"40",freeShipping:true,
      quantityDiscounts:[{minQuantity:2,unitPrice:200,totalPrice:400}],image:"/images/catalogue-test/sac.webp"
    }]},version:0})));
    await page.goto("/products/fixture-quantity-input?stats_test=1");
    const quantity = page.getByRole("spinbutton", { name: "الكمية", exact: true });
    await expect(quantity).toHaveAttribute("max", "1");
    await quantity.fill("2");
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await expect(quantity).toHaveValue("1");
    await expect(quantity).toHaveAttribute("aria-invalid", "false");
    await quantity.fill("3");
    await expect(page.locator(".purchase-price")).toContainText("630.00");
    await page.getByRole("button", { name: "أسود", exact: true }).click();
    await expect(quantity).toHaveValue("1");
    await expect(page.locator(".purchase-price")).toContainText("230.00");
    await page.getByRole("button", { name: "فتح السلة، 19 قطعة", exact: true }).first().click();
    await expect(page.getByRole("dialog").locator(".bag-quantity span")).toHaveText("19");
    await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("3830.00");
  });
}
