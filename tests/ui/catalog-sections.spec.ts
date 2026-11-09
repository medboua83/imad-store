import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
    test(`Femme and Homme keep separate categories and products at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?stats_test=1");
        const sections = page.getByRole("main").getByRole("navigation", { name: "أقسام المتجر" });
        const categoryRail = page.getByRole("navigation", { name: "تصفح حسب الفئة" });
        await sections.getByRole("link", { name: /Femme/ }).click();
        await expect(page).toHaveURL(/\/shop\?section=women$/);
        await expect(sections.getByRole("link", { name: /Femme/ })).toHaveAttribute("aria-current", "page");
        await expect(categoryRail.getByRole("link", { name: /معاطف نسائية/ })).toBeVisible();
        await expect(categoryRail.getByRole("link", { name: /صابو رجالي/ })).toHaveCount(0);
        await expect(page.locator(".catalog-card")).toHaveCount(1);
        const cover = page.locator(".catalog-card-image");
        await expect(cover).toHaveAttribute("href", /\/products\/fixture-premium\?/);
        await cover.click();
        const back = page.locator(".product-catalog-return");
        await expect(back).toHaveAttribute("href", "/shop?section=women#catalog-results");
        await back.click();
        await expect(sections.getByRole("link", { name: /Femme/ })).toHaveAttribute("aria-current", "page");
        await categoryRail.getByRole("link", { name: /معاطف نسائية/ }).click();
        await expect(page).toHaveURL(/category=manteau-femme/);
        if (width === 390) {
            await page.getByRole("button", { name: "فتح القائمة", exact: true }).click();
            await page.getByRole("dialog").getByRole("link", { name: /Homme/ }).click();
        } else {
            await sections.getByRole("link", { name: /Homme/ }).click();
        }
        await expect(page).toHaveURL(/\/shop\?section=men$/);
        await expect(categoryRail.getByRole("link", { name: /صابو رجالي/ })).toBeVisible();
        await expect(categoryRail.getByRole("link", { name: /معاطف نسائية/ })).toHaveCount(0);
        await expect(sections.getByRole("link", { name: /Homme/ })).toHaveAttribute("aria-current", "page");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`catalog-sections-${width}.png`) });
    });
}
