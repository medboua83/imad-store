import { test, expect } from "@playwright/test";

for (const width of [390, 1366]) {
    test(`Selection price stays separate from the next cart total at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/products/fixture-manual");
        const selection = page.locator(".quantity-selection-total");
        const price = page.locator(".purchase-price");
        const preview = page.getByLabel("تقدير السلة بعد الإضافة", { exact: true });
        const add = page.getByRole("button", { name: "إضافة إلى السلة", exact: true });
        await expect(selection).toContainText("230.00");
        await expect(preview).toHaveCount(0);
        await add.click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("230.00");
        // Opening the drawer must not make one selected piece appear to cost 400.
        await expect(price).toContainText("230.00");
        await expect(selection).toContainText("230.00");
        await page.screenshot({ path: info.outputPath(`one-piece-cart-${width}.png`) });
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await expect(preview).toContainText("في السلة الآن: 1");
        await expect(preview).toContainText("بعد إضافة 1: 2");
        await expect(preview).toContainText("400.00");
        await expect(page.getByLabel("الكمية", { exact: true })).toHaveValue("1");
        await add.click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("400.00");
        await page.reload();
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await expect(selection).toContainText("230.00");
        await expect(price).toContainText("230.00");
        await expect(preview).toContainText("في السلة الآن: 2");
        await expect(preview).toContainText("بعد إضافة 1: 3");
        await expect(preview).toContainText("630.00");
        await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
        await expect(selection).toContainText("630.00");
        await expect(price).toContainText("630.00");
        await expect(preview).toContainText("1030.00");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
}
