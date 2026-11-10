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
        await expect(cover).toHaveCSS("aspect-ratio", "3 / 4");
        await expect(cover.locator("img")).toHaveCSS("object-fit", "cover");
        await expect(cover.locator("img")).toHaveCSS("padding", "0px");
        await cover.click();
        const back = page.locator(".product-catalog-return");
        await expect(back).toHaveAttribute("href", "/shop?section=women#catalog-results");
        await back.click();
        await expect(sections.getByRole("link", { name: /Femme/ })).toHaveAttribute("aria-current", "page");
        await categoryRail.getByRole("link", { name: /معاطف نسائية/ }).click();
        await expect(page).toHaveURL(/category=manteau-femme/);
        const coatPhoto = categoryRail.getByRole("link", { name: /معاطف نسائية/ }).locator("img");
        await expect(coatPhoto).toHaveAttribute("src", /abaya.webp/);
        await expect(coatPhoto).toHaveCSS("object-fit", "cover");
        if (width === 390) {
            await page.getByRole("button", { name: "فتح القائمة", exact: true }).click();
            await page.getByRole("dialog").getByRole("link", { name: /Homme/ }).click();
        } else {
            await sections.getByRole("link", { name: /Homme/ }).click();
        }
        await expect(page).toHaveURL(/\/shop\?section=men$/);
        await expect(page.locator(".catalog-card-image").first()).toHaveCSS("aspect-ratio", "1 / 1");
        const clogsCategory = categoryRail.getByRole("link", { name: /صابو رجالي/ });
        await expect(clogsCategory).toBeVisible();
        await expect(clogsCategory.locator("img")).toHaveAttribute("src", /sabots-homme-v2.webp/);
        await expect(categoryRail.getByRole("link", { name: /معاطف نسائية/ })).toHaveCount(0);
        await expect(sections.getByRole("link", { name: /Homme/ })).toHaveAttribute("aria-current", "page");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`catalog-sections-${width}.png`) });
    });
}

for (const width of [320, 1440]) {
    test(`Category filters and sorting preserve the collection at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/shop?category=mens-clogs&section=men&stats_test=1");
        await expect(page.getByRole("heading", { level: 1, name: "صابو رجالي" })).toBeVisible();
        await expect(page.locator(".shop-collection-photo img")).toHaveAttribute("src", /sabots-homme-v2.webp/);
        await expect(page.locator(".active-filter-chips")).toHaveCount(0);

        const sort = page.locator(".collection-sort");
        await sort.locator("summary").click();
        await sort.getByRole("link", { name: "السعر: من الأقل" }).click();
        await expect(page).toHaveURL(url =>
            url.searchParams.get("category") === "mens-clogs" &&
            url.searchParams.get("section") === "men" &&
            url.searchParams.get("sort") === "price-asc" &&
            url.hash === "#catalog-results",
        );

        const filters = page.locator("#catalog-search");
        await filters.locator("summary").click();
        await expect(filters.locator("input[name=category]")).toHaveValue("mens-clogs");
        await filters.locator("input[name=maxPrice]").fill("300");
        await page.screenshot({ path: info.outputPath(`collection-filters-${width}.png`) });
        await filters.getByRole("button", { name: "عرض النتائج" }).click();
        await expect(page).toHaveURL(url =>
            url.searchParams.get("category") === "mens-clogs" &&
            url.searchParams.get("section") === "men" &&
            url.searchParams.get("maxPrice") === "300" &&
            url.searchParams.get("sort") === "price-asc" &&
            url.hash === "#catalog-results",
        );
        await page.getByRole("link", { name: "المتوفر فقط", exact: true }).click();
        await expect(page).toHaveURL(url =>
            url.searchParams.get("availability") === "in-stock" &&
            url.searchParams.get("maxPrice") === "300",
        );
        await page.getByRole("link", { name: "مسح الكل", exact: true }).click();
        await expect(page).toHaveURL(/\/shop\?category=mens-clogs&section=men$/);
        await expect(page.locator(".active-filter-chips")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}
