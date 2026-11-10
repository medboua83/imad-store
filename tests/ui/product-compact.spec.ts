import { test, expect } from "@playwright/test";

for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
]) {
    test(`Purchase essentials remain reachable at ${viewport.width}px`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/products/fixture-manual");
        const buy = page.getByRole("button", { name: "إضافة إلى السلة", exact: true });
        await expect(buy).toBeEnabled();
        const box = await buy.boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        if (viewport.width > 767) {
            for (const selector of [
                ".product-variant-grid",
                ".quantity-choice-grid",
            ]) {
                const rect = await page.locator(selector).boundingBox();
                expect(rect!.y).toBeGreaterThan(0);
                expect(rect!.y + rect!.height).toBeLessThan(box!.y);
            }
            const quantity = await page.locator(".product-quantity-row").boundingBox();
            expect(quantity!.y).toBeGreaterThan(0);
            expect(quantity!.y + quantity!.height).toBeLessThanOrEqual(viewport.height);
            // On short desktops the quantity and purchase button share one row.
            expect(quantity!.x >= box!.x + box!.width || quantity!.x + quantity!.width <= box!.x).toBe(true);
        }
        await page.screenshot({ path: info.outputPath(`compact-initial-${viewport.width}.png`) });
        if (viewport.width < 768) {
            await page.getByRole("link", { name: "تعديل الخيارات" }).click();
            await expect(page).toHaveURL(/#product-options$/);
            await expect(page.locator("#product-options")).toBeFocused();
            const variants = await page.locator(".product-variant-grid").boundingBox();
            expect(variants!.y).toBeGreaterThan(0);
            expect(variants!.y + variants!.height).toBeLessThan(box!.y);
        }
        const brown = page.getByRole("button", { name: "بني", exact: true });
        const target = await brown.boundingBox();
        expect(target!.width).toBeGreaterThanOrEqual(44);
        expect(target!.height).toBeGreaterThanOrEqual(44);
        await brown.click();
        await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
        await expect(page.locator(".purchase-price")).toContainText("630.00");
        await page.getByText("تفاصيل السعر والعروض", { exact: true }).click();
        await expect(page.getByLabel("تفصيل السعر حسب العروض", { exact: true })).toContainText(
            "1 × عرض 2 قطع",
        );
        await expect(page.getByLabel("تفصيل السعر حسب العروض", { exact: true })).toContainText(
            "1 × قطعة بالسعر العادي",
        );
        if (viewport.width < 768) {
            await page.getByText("كيف تختارون المقاس المناسب؟", { exact: true }).click();
            const fixed = await buy.boundingBox();
            expect(fixed!.y + fixed!.height).toBeLessThanOrEqual(viewport.height);
        }
        await buy.click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("630.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        expect(errors).toEqual([]);
    });
}
