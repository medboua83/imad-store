import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
    test(`Product return restores filters, page and result position at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const filters = "search=page-fixture&category=mens-clogs&sort=price-asc&minPrice=100&maxPrice=500&availability=in-stock&size=40&page=2";
        await page.goto(`/shop?${filters}`);
        await page.locator(".catalog-card .text-link").click();
        const back = page.getByRole("link", { name: "العودة إلى النتائج", exact: true });
        await expect(back).toBeVisible();
        expect(new URL(page.url()).searchParams.get("size")).toBe("40");
        await expect(page.getByRole("button", { name: "40", exact: true })).toHaveAttribute("aria-pressed", "true");
        const canonical = new URL("/products/fixture-sabot", page.url()).href;
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical);
        await page.screenshot({ path: info.outputPath(`product-return-${width}.png`) });
        await back.click();
        await expect(page).toHaveURL(url => url.pathname === "/shop" && url.hash === "#catalog-results");
        for (const [key, value] of new URLSearchParams(filters))
            expect(new URL(page.url()).searchParams.get(key)).toBe(value);
        await expect(page.locator(".shop-pagination")).toContainText("2 / 3");
        await expect(page.locator("#catalog-results")).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`catalog-return-${width}.png`) });
    });
}

test("Unavailable size recovery retains safe catalogue context and never changes social URLs", async ({ page }) => {
    const returnTo = "/shop?category=mens-clogs&size=40&page=2";
    await page.goto(`/products/fixture-sabot?size=99&returnTo=${encodeURIComponent(returnTo)}`);
    await page.getByRole("link", { name: "عرض المقاسات الأخرى", exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname === "/products/fixture-sabot" && !url.searchParams.has("size"));
    await expect(page.getByRole("link", { name: "العودة إلى النتائج", exact: true })).toHaveAttribute("href", returnTo + "#catalog-results");
    await expect(page.getByRole("button", { name: "إضافة إلى السلة", exact: true })).toBeEnabled();
    await page.goto("/products/fixture-sabot?returnTo=https%3A%2F%2Fevil.example%2Fshop");
    await expect(page.getByRole("link", { name: "العودة إلى النتائج", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "مسار التصفح" }).getByRole("link", { name: "المتجر", exact: true })).toHaveAttribute("href", "/shop");
});
