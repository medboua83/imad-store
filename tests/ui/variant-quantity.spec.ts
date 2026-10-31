import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`Variant choices preserve quantity and clamp to their stock at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/products/fixture-manual?stats_test=1");
    const quantity = page.locator("#product-quantity");
    const price = page.locator(".quantity-selection-total");
    const two = page.getByRole("button", { name: "اختيار قطعتين", exact: true });
    await two.click();
    await expect(quantity).toHaveValue("2");
    await page.getByRole("button", { name: "40", exact: true }).click();
    await expect(quantity).toHaveValue("2");
    await expect(two).toHaveAttribute("aria-pressed", "true");
    await expect(price).toContainText("400.00");

    await page.getByRole("button", { name: "بني", exact: true }).click();
    await expect(page.getByRole("button", { name: "44", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(quantity).toHaveValue("2");
    await expect(price).toContainText("400.00");
    await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
    await page.getByRole("button", { name: "44", exact: true }).click();
    await expect(quantity).toHaveValue("3");
    await expect(price).toContainText("630.00");

    // Black has two units: colour changes cannot exceed the destination stock.
    await page.getByRole("button", { name: "أسود", exact: true }).click();
    await expect(quantity).toHaveValue("2");
    await expect(price).toContainText("400.00");
    await expect(page.getByRole("button", { name: "اختيار 3 قطع", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await expect(quantity).toHaveValue("2");
    await expect(page.locator(".purchase-price")).toContainText("400.00");
    await page.screenshot({ path: info.outputPath(`variant-quantity-${width}.png`) });
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".bag-quantity span")).toHaveText("2");
    await expect(dialog).toContainText("بني · 44");
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Quantity changes subtract units already in the basket at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/products/fixture-manual?stats_test=1");
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("400.00");
    await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
    await page.getByRole("button", { name: "أسود", exact: true }).click();
    await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
    await expect(page.locator("#product-quantity")).toHaveValue("2");
    await page.getByRole("button", { name: "بني", exact: true }).click();
    await expect(page.locator("#product-quantity")).toHaveValue("1");
    await expect(page.locator(".quantity-selection-total")).toContainText("230.00");
    await expect(page.locator(".availability-note")).toContainText("1 قطعة متاحة");
    await expect(page.getByRole("button", { name: "اختيار قطعتين", exact: true })).toBeDisabled();
    await expect(page.locator(".quantity-cart-preview")).toContainText("630.00");
    await page.screenshot({ path: info.outputPath(`variant-reserved-stock-${width}.png`) });
    // Choosing an option alone never adds, removes or changes basket lines.
    await page.getByRole("button", { name: "فتح السلة، 2 قطعة", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".bag-quantity span")).toHaveText("2");
    await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
  });
}
