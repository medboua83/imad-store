import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  for (const dismiss of ["escape", "close", "continue"]) {
    test(`Full-stock basket returns keyboard focus after ${dismiss} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      let orders = 0;
      await page.route("**/api/orders", route => { orders++; return route.abort(); });
      await page.goto("/products/fixture-manual?stats_test=1");
      await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
      await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
      await expect(page.locator(".product-purchase-bar button")).toBeDisabled();
      if (dismiss === "escape") await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).press("Escape");
      else await dialog.getByRole("button", { name: dismiss === "close" ? "إغلاق السلة" : "متابعة التسوق", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await info.attach("focus-after-dismiss", { body: JSON.stringify(await page.evaluate(() => ({
        tag: document.activeElement?.tagName, class: document.activeElement?.className,
      }))), contentType: "application/json" });
      const trigger = page.locator(".site-header .cart-toggle");
      await expect(trigger).toBeFocused();
      if (dismiss === "escape") await page.screenshot({ path: info.outputPath(`basket-focus-return-${width}.png`) });
      await trigger.press("Enter");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".bag-quantity span")).toHaveText("2");
      await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
      await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
      await expect(trigger).toBeFocused();
      expect(orders).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  test(`Basket keeps the original usable focus target and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let orders = 0;
    await page.route("**/api/orders", route => { orders++; return route.abort(); });
    await page.goto("/products/fixture-manual?stats_test=1");
    const add = page.getByRole("button", { name: "إضافة إلى السلة", exact: true });
    await add.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
    await dialog.getByRole("button", { name: "إغلاق السلة", exact: true }).press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(add).toBeFocused();
    await page.locator(".site-header .cart-toggle").click();
    await dialog.getByRole("link", { name: "متابعة الطلب", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator(".checkout-compact-total")).toContainText("230.00");
    await expect(dialog).not.toBeVisible();
    expect(orders).toBe(0);
  });
}
