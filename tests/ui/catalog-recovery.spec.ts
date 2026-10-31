import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
    test(`Invalid catalog filters do not show unfiltered products at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/shop?category=mens-clogs&search=fixture&minPrice=500&maxPrice=100");
        await expect(page.getByRole("main").getByRole("alert")).toContainText("صححوا الفلاتر");
        await expect(page.locator("#catalog-search")).toHaveAttribute("open", "");
        await expect(page.locator(".catalog-card")).toHaveCount(0);
        await expect(
            page.locator(".catalog-results-heading, .active-filter-chips, .shop-empty-state"),
        ).toHaveCount(0);
        await expect(page.locator('[name="minPrice"]')).toHaveValue("500");
        await expect(page.locator('[name="maxPrice"]')).toHaveValue("100");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({
            path: info.outputPath(`invalid-filters-${width}.png`),
            fullPage: true,
        });
        await page.locator('[name="minPrice"]').fill("100");
        await page.locator('[name="maxPrice"]').fill("500");
        await page.getByRole("button", { name: "عرض النتائج", exact: true }).click();
        await expect(page.locator(".catalog-card")).toHaveCount(1);
        await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
        expect(new URL(page.url()).searchParams.get("category")).toBe("mens-clogs");
        await expect(page.locator(".active-filter-chips")).toContainText("fixture");
        await page.goto("/shop?sort=invalid-sort");
        await expect(page.getByRole("main").getByRole("alert")).toContainText("صححوا الفلاتر");
        await expect(page.locator(".catalog-card")).toHaveCount(0);
    });

    test(`Missing catalog page recovers without losing filters at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const filters =
            "search=page-fixture&category=mens-clogs&sort=price-asc&availability=in-stock";
        await page.goto(`/shop?${filters}&page=99`);
        await expect(page.getByRole("heading", { name: "هذه الصفحة غير متاحة." })).toBeVisible();
        await expect(page.locator(".shop-empty-state")).not.toContainText("لم نجد القطعة");
        await expect(page.locator(".shop-pagination")).toHaveCount(0);
        const recovery = page.getByRole("link", { name: "العودة إلى أول صفحة", exact: true });
        const target = new URL((await recovery.getAttribute("href"))!, page.url());
        expect(target.searchParams.has("page")).toBe(false);
        for (const [key, value] of new URLSearchParams(filters))
            expect(target.searchParams.get(key)).toBe(value);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({
            path: info.outputPath(`missing-page-${width}.png`),
            fullPage: true,
        });
        await recovery.click();
        await expect(page.locator(".catalog-card")).toHaveCount(1);
        await expect(page.locator(".shop-pagination")).toContainText("1 / 3");
        await page.getByRole("link", { name: "الصفحة التالية", exact: true }).click();
        await expect(page.locator(".shop-pagination")).toContainText("2 / 3");
        expect(new URL(page.url()).searchParams.get("availability")).toBe("in-stock");
        await page.getByRole("link", { name: "الصفحة السابقة", exact: true }).click();
        await expect(page.locator(".shop-pagination")).toContainText("1 / 3");
        await page.goto("/shop?search=empty-fixture&page=99");
        await expect(
            page.getByRole("heading", { name: "لم نجد القطعة بهذه التفاصيل." }),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "العودة إلى أول صفحة", exact: true }),
        ).toHaveCount(0);
    });
}

test("An unavailable catalog is an error, not empty or unfiltered results", async ({ page }) => {
    await page.goto("/shop?search=outage-fixture");
    await expect(page.getByRole("heading", { name: "تعذر تحميل هذه الصفحة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "إعادة المحاولة", exact: true })).toBeVisible();
    await expect(page.locator(".catalog-card, .shop-empty-state, .shop-filter-error")).toHaveCount(
        0,
    );
});
