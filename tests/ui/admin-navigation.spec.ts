import { test, expect, type Page } from "@playwright/test";

test.use({ timezoneId: "America/Los_Angeles" });
const category = { id: "111111111111111111111111", slug: "mens-clogs", nameFr: "Sabots", nameAr: "صابو", nameEn: "Clogs" };
const product = {
    id: "222222222222222222222222", slug: "navigation-fixture", nameFr: "Article navigation",
    nameAr: "منتج تجريبي", nameEn: "Navigation item", descriptionFr: "", descriptionAr: "", descriptionEn: "",
    category, price: 230, status: "ACTIVE", images: ["/images/catalogue-test/sac.webp"],
    variants: [{ id: "333333333333333333333333", sku: "NAV-FIXTURE", color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", size: "40", stock: 5 }],
};
async function mockAdmin(page: Page) {
    const writes: string[] = [];
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-navigation-fixture"));
    await page.route("**/api/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (request.method() !== "GET") { writes.push(path); return route.fulfill({ status: 405 }); }
        const data = path === "/api/products/admin/catalog" ? [product] : path === "/api/products/" + product.id ? product : path === "/api/categories" ? [category] : [];
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data, total: Array.isArray(data) ? data.length : 0, page: 1, totalPages: 1, unread: 0 }) });
    });
    return writes;
}
async function tab(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if (await menu.isVisible() && await menu.getAttribute("aria-expanded") === "false") await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}

for (const width of [390, 1440]) {
    test(`Admin direct links, reload and browser history preserve open product edits at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const writes = await mockAdmin(page);
        await page.goto("/admin?tab=products&keep=1");
        const heading = page.locator(".admin-page-heading h1");
        await expect(heading).toHaveText("Produits");
        await page.reload();
        await expect(heading).toHaveText("Produits");
        await page.getByRole("button", { name: "Modifier Article navigation", exact: true }).click();
        await page.getByLabel("Nom français", { exact: true }).fill("Brouillon conservé");
        await tab(page, "Commandes");
        await expect(heading).toHaveText("Commandes");
        await expect(page).toHaveURL(url => url.searchParams.get("tab") === "orders" && url.searchParams.get("keep") === "1");
        await page.goBack();
        await expect(heading).toHaveText("Produits");
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Brouillon conservé");
        await page.goForward();
        await expect(heading).toHaveText("Commandes");
        await page.goBack();
        await page.getByRole("combobox", { name: "Langue de l’administration / لغة لوحة الإدارة" }).selectOption("ar");
        await expect(heading).toHaveText("المنتجات");
        await expect(page.getByLabel("الاسم الفرنسي", { exact: true })).toHaveValue("Brouillon conservé");
        expect(new URL(page.url()).searchParams.get("tab")).toBe("products");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`admin-navigation-${width}.png`) });
        expect(writes).toEqual([]);
    });
}

test("Unknown admin sections stay on overview and sync time follows Morocco rather than the device timezone", async ({ page }) => {
    await mockAdmin(page);
    // Fixed historical date: the expected offset must not depend on future tzdb revisions.
    await page.clock.install({ time: new Date("2025-11-06T12:00:00Z") });
    await page.goto("/admin?tab=https%3A%2F%2Fevil.example");
    await expect(page.locator(".admin-page-heading h1")).toHaveText("Vue d’ensemble");
    await expect(page.locator(".admin-sync")).toHaveText("À jour à 13:00");
    await tab(page, "Produits");
    expect(new URL(page.url()).searchParams.get("tab")).toBe("products");
});
