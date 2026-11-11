import { expect, test, type Page } from "@playwright/test";

const category = { id: "111111111111111111111111", slug: "accessoires", nameFr: "Accessoires", nameAr: "إكسسوارات", nameEn: "Accessories" };
const base = { descriptionFr: "", descriptionAr: "", descriptionEn: "", price: 200, status: "ACTIVE", category, images: ["/images/catalogue-test/chale.webp"] };
const variant = { color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", size: "40", stock: 5 };
const scarf = { ...base, id: "222222222222222222222222", slug: "echarpe-ete", nameFr: "Écharpe d’été", nameAr: "وشاح صيفي", nameEn: "Summer scarf",
    variants: Array.from({ length: 65 }, (_, i) => ({ ...variant, id: (i + 100).toString(16).padStart(24, "0"), sku: `ETE-${String(i + 1).padStart(3, "0")}`, stock: i === 0 ? 0 : i === 1 ? 2 : 5 })) };
const cotton = { ...base, id: "444444444444444444444444", slug: "coton", nameFr: "Coton de recette", nameAr: "وشاح قطني", nameEn: "Cotton scarf",
    variants: [{ ...variant, id: "555555555555555555555555", sku: "COTON-RED-44", size: "44", color: "#ff0000", colorNameFr: "Rouge", colorNameAr: "أحمر" },
        { ...variant, id: "666666666666666666666666", sku: "COTON-BLACK-42", size: "42" }] };
async function navigate(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if (await menu.isVisible() && await menu.getAttribute("aria-expanded") === "false") await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}
for (const width of [320, 390, 1440]) {
    test(`Catalogue search and stock navigation preserve context at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem("adminToken", "isolated-catalogue-search");
            localStorage.setItem("imad-admin-language", "fr");
        });
        const writes: string[] = [];
        await page.route("**/api/**", async route => {
            const req = route.request(), path = new URL(req.url()).pathname;
            if (req.method() !== "GET") { writes.push(path); return route.fulfill({ status: 405 }); }
            const data = path === "/api/products/admin/catalog" ? [scarf, cotton] : path === "/api/categories" ? [category] : [];
            return route.fulfill({ json: { success: true, data, total: data.length, unread: 0 } });
        });
        await page.goto("/admin?tab=products");
        const search = page.getByRole("searchbox", { name: "Rechercher un produit", exact: true });
        const products = page.locator(".admin-product-list");
        await search.fill("echarpe noir ٤٠");
        await expect(products.getByRole("heading", { name: "Écharpe d’été", exact: true })).toBeVisible();
        await expect(products.getByRole("heading", { name: "Coton de recette", exact: true })).toHaveCount(0);
        // Color and size must belong to the same variant, not two unrelated variants.
        await search.fill("coton noir 44");
        await expect(products.getByRole("heading")).toHaveCount(0);
        await search.fill("وِشاح صَيفي");
        await expect(products.getByRole("heading", { name: "Écharpe d’été", exact: true })).toBeVisible();
        await navigate(page, "Stock");
        const stockSearch = page.getByRole("searchbox", { name: "Rechercher dans le stock", exact: true });
        await stockSearch.fill("echarpe noir ۴۰");
        const results = page.locator(".admin-inventory-results");
        await expect(results).toContainText("65 variante(s)");
        const topPages = page.getByRole("navigation", { name: "Navigation du stock, début", exact: true });
        await topPages.getByRole("button", { name: "Page suivante", exact: true }).click();
        await expect(topPages).toContainText("Page 2 sur 3");
        await expect(results).toContainText("31–60");
        await expect(results).toBeFocused();
        expect(await results.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(150);
        const rows = page.locator(".admin-inventory-list");
        await expect(rows.locator("li")).toHaveCount(30);
        await expect(rows.locator("li").first()).toContainText("ETE-031");
        await rows.getByRole("button", { name: "Voir le produit Écharpe d’été", exact: true }).first().click();
        await page.getByRole("button", { name: "Modifier Écharpe d’été", exact: true }).click();
        await page.getByLabel("Nom français", { exact: true }).fill("Brouillon conservé");
        await page.goBack();
        await expect(stockSearch).toHaveValue("echarpe noir ۴۰");
        await expect(topPages).toContainText("Page 2 sur 3");
        await expect(rows.locator("li").first()).toContainText("ETE-031");
        await page.goForward();
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Brouillon conservé");
        await navigate(page, "Vue d’ensemble");
        await page.locator(".admin-task-grid").getByRole("button", { name: /Variantes en stock faible.*1/ }).click();
        await expect(stockSearch).toHaveValue("");
        await expect(results).toContainText("1 variante(s)");
        await expect(rows.locator("li")).toHaveCount(1);
        await page.getByRole("button", { name: "Effacer la recherche et les filtres", exact: true }).click();
        await expect(results).toContainText("67 variante(s)");
        await expect(topPages).toContainText("Page 1 sur 3");
        await page.getByLabel("Langue de l’administration / لغة لوحة الإدارة").selectOption("ar");
        const arabicSearch = page.getByRole("searchbox", { name: "البحث في المخزون", exact: true });
        await arabicSearch.fill("وِشاح ٤٠");
        await expect(rows.locator("li")).toHaveCount(30);
        await expect(results).toContainText("65");
        for (const value of ["ETE-031", "وِشاح ٤٠"]) {
            await arabicSearch.fill(value);
            const padding = await arabicSearch.evaluate(el => ({ left: parseFloat(getComputedStyle(el).paddingLeft), right: parseFloat(getComputedStyle(el).paddingRight) }));
            expect(padding.left).toBeGreaterThanOrEqual(38);
            expect(padding.right).toBeGreaterThanOrEqual(38);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`stock-search-${width}.png`) });
        expect(writes).toEqual([]);
    });
}
