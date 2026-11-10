import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
    test(`Header search suggests products and supports a full search at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 840 });
        const requested: string[] = [];
        await page.route(/\/api\/products\?.*limit=5/, async route => {
            const url = new URL(route.request().url());
            const search = url.searchParams.get("search") ?? "";
            requested.push(search);
            if (search === "outage") {
                await route.fulfill({ status: 503, json: { success: false } });
                return;
            }
            await route.fulfill({ json: { data: search === "صا" ? [{
                id: "fixture", slug: "fixture-sabot", nameAr: "صابو البحث", price: 230,
                images: ["/images/catalogue-test/sabot.webp"],
            }] : [] } });
        });
        await page.goto("/");
        const trigger = page.getByRole("button", { name: "البحث في المتجر" });
        await trigger.click();
        const panel = page.getByRole("dialog", { name: "البحث في المتجر" });
        const search = panel.getByRole("searchbox");
        await expect(search).toBeFocused();
        await search.fill("ص");
        await expect(panel.getByRole("status")).toContainText("حرفين");
        expect(requested).toEqual([]);
        await search.fill("صا");
        const suggestion = panel.getByRole("link", { name: /صابو البحث/ });
        await expect(suggestion).toHaveAttribute("href", "/products/fixture-sabot");
        await expect(suggestion).toContainText("230.00 MAD");
        await page.keyboard.press("Escape");
        await expect(panel).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await search.fill("outage");
        await expect(panel.getByRole("status")).toContainText("تعذر");
        await search.press("Enter");
        await expect(page).toHaveURL(url => url.pathname === "/shop" && url.searchParams.get("search") === "outage");
        await expect(panel).not.toBeVisible();
    });
}
