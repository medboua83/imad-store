import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1440]) {
    test(`Multiple sizes require a deliberate choice, including after colour fallback at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        let orderWrites = 0;
        await page.route("**/api/orders", route => { orderWrites++; return route.abort(); });
        await page.goto("/products/fixture-sabot");
        const choose = page.getByRole("button", {name:"اختاروا المقاس", exact:true});
        await expect(choose).toBeEnabled();
        await expect(page.locator('.size-options [aria-pressed="true"]')).toHaveCount(0);
        await expect(page.locator("#product-quantity")).toBeDisabled();
        await choose.click();
        await expect(page.getByRole("button", {name:"40",exact:true})).toBeFocused();
        await expect(page.locator(".cart-dialog")).not.toBeVisible();
        await page.getByRole("button", {name:"40",exact:true}).click();
        await expect(page.getByRole("button", {name:"إضافة إلى السلة",exact:true})).toBeEnabled();
        await page.getByRole("button", {name:"بني",exact:true}).click();
        await expect(choose).toBeVisible();
        await expect(page.locator('.size-options [aria-pressed="true"]')).toHaveCount(0);
        await expect(page.locator(".purchase-selection")).not.toContainText("44");
        await page.getByRole("button", {name:"44",exact:true}).click();
        await expect(page.locator(".purchase-selection")).toContainText("بني · 44");
        await page.screenshot({path:info.outputPath(`deliberate-size-${width}.png`)});
        await page.getByRole("button", {name:"إضافة إلى السلة",exact:true}).click();
        await expect(page.locator(".bag-line-detail")).toContainText("بني · 44");
        expect(orderWrites).toBe(0);
    });
}

test("A single real size needs no redundant size confirmation", async ({page}) => {
    await page.goto("/products/fixture-premium");
    await expect(page.getByRole("button",{name:"M",exact:true})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByRole("button",{name:"اختاروا المقاس",exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"إضافة إلى السلة",exact:true})).toBeEnabled();
});

test("A product description and its metadata omit editorial instructions without removing facts", async ({page}) => {
    await page.goto("/products/fixture-editorial");
    const copy = await page.locator(".product-description").allTextContents();
    expect(copy.join(" ")).not.toMatch(/ad copy|للموقع|للإعلانات|الموديل الأول|المنتج الآخر/);
    expect(copy.join(" ")).toContain("روبة واسعة بقماش ناعم");
    await expect(page.locator('meta[name="description"]')).not.toHaveAttribute("content", /ad copy|للإعلانات|المنتج الآخر/);
    expect(await page.locator('script[type="application/ld+json"]').textContent()).not.toMatch(/ad copy|للإعلانات|المنتج الآخر/);
});
