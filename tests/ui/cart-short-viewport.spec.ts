import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`Basket items and checkout stay reachable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    let orders = 0;
    await page.route("**/api/orders", route => { orders++; return route.abort(); });
    await page.goto("/products/fixture-manual?stats_test=1");
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const close = dialog.getByRole("button", { name: "إغلاق السلة", exact: true });
    const checkout = dialog.getByRole("link", { name: "متابعة الطلب", exact: true });
    await expect(checkout).toBeEnabled();
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
    if (viewport.height <= 600) {
      const header = await dialog.locator(".bag-header").boundingBox();
      const bounds = await dialog.boundingBox();
      await page.mouse.move(bounds!.x + bounds!.width / 2, header!.y + header!.height + 25);
      await page.mouse.wheel(0, 1500);
      await expect.poll(async () => {
        const button = await checkout.boundingBox();
        return !!button && button.y >= 0 && button.y + button.height <= viewport.height;
      }).toBe(true);
      await expect(close).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: info.outputPath(`basket-short-total-${viewport.width}.png`) });
    }
    await dialog.getByRole("button", { name: "تقليل كمية صابو تجريبي", exact: true }).click();
    await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
    await close.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true }).first().click();
    await expect(checkout).toBeVisible();
    await dialog.getByRole("button", { name: "زيادة كمية صابو تجريبي", exact: true }).click();
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
    await checkout.focus();
    // Native focus scrolling can round the border by a fraction of a pixel.
    await expect(checkout).toBeInViewport({ ratio: 0.99 });
    await expect(close).toBeInViewport({ ratio: 1 });
    await checkout.press("Tab");
    await expect.poll(() => dialog.evaluate(e => e.contains(document.activeElement))).toBe(true);
    await checkout.click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(".checkout-compact-total")).toContainText("400.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(orders).toBe(0);
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`Delivery recovery remains reachable in a short basket at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let failed = true, orders = 0;
    await page.route("**/api/settings", route => failed ? route.abort() : route.continue());
    await page.route("**/api/orders", route => { orders++; return route.abort(); });
    await page.goto("/products/fixture-manual?stats_test=1");
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "متابعة الطلب", exact: true })).toBeDisabled();
    await expect(dialog.locator(".bag-grand-total")).toContainText("بانتظار رسوم التوصيل");
    const retry = dialog.getByRole("button", { name: "إعادة المحاولة", exact: true });
    await retry.focus();
    await expect(retry).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole("button", { name: "إغلاق السلة", exact: true })).toBeInViewport({ ratio: 1 });
    failed = false;
    await retry.press("Enter");
    const checkout = dialog.getByRole("link", { name: "متابعة الطلب", exact: true });
    await expect(checkout).toBeVisible();
    await checkout.focus();
    // Native focus scrolling can round the border by a fraction of a pixel.
    await expect(checkout).toBeInViewport({ ratio: 0.99 });
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
    expect(orders).toBe(0);
  });
}
