import { expect, test } from "@playwright/test";

test("Published collections have individual pages and share metadata", async ({ page, request }) => {
    await page.goto("/collections/manteau-femme");
    await expect(page.getByRole("heading", { name: "معاطف نسائية", level: 1 })).toBeVisible();
    const canonical = new URL("/collections/manteau-femme", page.url()).href;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /معاطف نسائية/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /abaya\.webp/);
    await page.goto("/shop?category=manteau-femme");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/collections/manteau-femme");
    expect((await request.get("/collections/empty-category")).status()).toBe(404);
});
