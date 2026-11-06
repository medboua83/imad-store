import { test, expect } from "@playwright/test";

for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
]) {
    test(`Quantity prices and variant recap match the cart at ${viewport.width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize(viewport);
        await page.goto("/products/fixture-manual?stats_test=1");
        const one = page.getByRole("button", { name: "اختيار قطعة واحدة", exact: true });
        const two = page.getByRole("button", { name: "اختيار قطعتين", exact: true });
        const three = page.getByRole("button", { name: "اختيار 3 قطع", exact: true });
        await expect(one.locator(".quantity-choice-price")).toHaveText("230.00 MAD");
        await expect(one.locator(".quantity-choice-saving")).toHaveCount(0);
        await expect(two.locator(".quantity-choice-price")).toHaveText("400.00 MAD");
        await expect(two).toHaveAccessibleDescription(/400.00 MAD.*60.00 MAD/);
        await expect(three.locator(".quantity-choice-price")).toHaveText("630.00 MAD");
        await expect(three).toBeDisabled();
        const recap = page.locator(".purchase-selection");
        await expect(recap).toHaveText("أسود · 40 · 1 قطعة");
        const add = page.getByRole("button", { name: "إضافة إلى السلة", exact: true });
        const box = await add.boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await three.click();
        await expect(recap).toHaveText("بني · 44 · 3 قطع");
        await expect(page.locator(".purchase-price")).toContainText("630.00");
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
            const selectedBox = await add.boundingBox();
            expect(selectedBox!.y).toBeGreaterThanOrEqual(0);
            expect(selectedBox!.y + selectedBox!.height).toBeLessThanOrEqual(viewport.height);
        await page.screenshot({ path: info.outputPath(`purchase-clarity-${viewport.width}.png`) });
        await add.click();
        const cart = page.getByRole("dialog");
        await expect(cart.locator(".bag-quantity span")).toHaveText("3");
        await expect(cart.locator(".bag-grand-total")).toContainText("630.00");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
}

test("Ordinary prices are not advertised as promotions and invalid quantities hide the old recap", async ({
    page,
}) => {
    await page.goto("/products/fixture-sabot?stats_test=1");
    await expect(
        page
            .getByRole("button", { name: "اختيار قطعتين", exact: true })
            .locator(".quantity-choice-price"),
    ).toHaveText("460.00 MAD");
    await expect(page.locator(".quantity-choice-saving")).toHaveCount(0);
    await page.getByRole("spinbutton", { name: "الكمية", exact: true }).fill("");
    await expect(page.locator(".purchase-selection")).toHaveText("تحققوا من الكمية");
    await expect(page.locator(".purchase-price")).toContainText("—");
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeDisabled();
});

test("A manually entered quantity offer takes priority in the displayed choices", async ({
    page,
}) => {
    await page.goto("/products/fixture-override?stats_test=1");
    await page.getByRole("button", { name: "بني", exact: true }).click();
    const three = page.getByRole("button", { name: "اختيار 3 قطع", exact: true });
    await expect(three.locator(".quantity-choice-price")).toHaveText("650.00 MAD");
    await three.click();
    await expect(page.locator(".quantity-selection-total")).toContainText("650.00");
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("650.00");
});
