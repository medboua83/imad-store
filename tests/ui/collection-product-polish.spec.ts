import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
    test(`Compact collection and accessible filters at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto("/shop?category=mens-clogs&section=men&stats_test=1");
        const cover = page.locator(".catalog-card-image").first();
        await expect(cover).toBeVisible();
        const initialTop = (await cover.boundingBox())!.y;
        expect(initialTop).toBeLessThan(width < 768 ? 470 : 580);
        const trigger = page.getByRole("button", { name: "البحث والفلاتر", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "البحث والفلاتر", exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("button", { name: "إغلاق الفلاتر" })).toBeFocused();
        await expect(page.locator('form.catalog-filter-form')).toHaveCount(1);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("link", { name: "مسح الفلاتر" })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(dialog.getByRole("button", { name: "إغلاق الفلاتر" })).toBeFocused();
        await dialog.locator('[name="maxPrice"]').fill("300");
        await page.screenshot({ path: info.outputPath(`filters-${width}.png`) });
        await dialog.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(dialog.locator('[name="maxPrice"]')).toHaveValue("300");
        await dialog.getByRole("button", { name: "عرض النتائج", exact: true }).click();
        await expect(page).toHaveURL(url => url.searchParams.get("maxPrice") === "300" &&
            url.searchParams.get("category") === "mens-clogs" && url.searchParams.get("section") === "men");
        await expect(page.locator("#catalog-search")).not.toBeVisible();
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
        await expect(page.locator(".active-filter-chips")).toContainText("300");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`collection-${width}.png`) });
        expect(errors).toEqual([]);
    });

    test(`Original portrait and readable product copy at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/products/fixture-readable");
        const photo = page.locator(".gallery-stage img");
        await expect(photo).toHaveJSProperty("complete", true);
        await expect(photo).toHaveAttribute("src", /\/images\/catalogue-test\/abaya.webp$/);
        await expect(photo).toHaveCSS("object-fit", "contain");
        const stage = (await page.locator(".gallery-stage").boundingBox())!;
        if (width < 768) expect(stage.height).toBeGreaterThanOrEqual(320);
        await expect(page.locator(".product-description").first()).toHaveText("عنوان القطعة");
        await expect(page.locator(".product-description-list li")).toHaveText(["لون بني", "طول 90 cm"]);
        await expect(page.locator(".product-information")).toContainText("5 > 3");
        await expect(page.locator(".product-information")).toContainText("<script>window.untrustedProductCopy=true</script>");
        expect(await page.evaluate(() => (window as any).untrustedProductCopy)).toBeUndefined();
        const buy = (await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).boundingBox())!;
        if (width < 768) expect(buy.y + buy.height).toBeLessThanOrEqual(844);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`product-${width}.png`) });
    });
}

test("Filter resize keeps the single draft and restores page scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop?filters=open");
    const dialog = page.getByRole("dialog", { name: "البحث والفلاتر", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.locator('[name="search"]').fill("draft");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(dialog.locator('[name="search"]')).toHaveValue("draft");
    await dialog.getByRole("button", { name: "إغلاق الفلاتر" }).click();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await expect(page.getByRole("button", { name: "البحث والفلاتر", exact: true })).toBeFocused();
});
