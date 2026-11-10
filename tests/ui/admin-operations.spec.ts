import { expect, test, type Page } from "@playwright/test";

const category = {
    id: "111111111111111111111111",
    slug: "abayas",
    nameFr: "Abayas",
    nameAr: "عبايات",
    nameEn: "Abayas",
};
const lowProduct = {
    id: "222222222222222222222222",
    slug: "abaya-fixture",
    nameFr: "Abaya de recette",
    nameAr: "عباية تجريبية",
    nameEn: "Fixture abaya",
    descriptionFr: "", descriptionAr: "", descriptionEn: "",
    category, price: 280, status: "ACTIVE", images: ["/images/catalogue-test/sac.webp"],
    variants: [{
        id: "333333333333333333333333",
        sku: "ABAYA-LOW-M",
        color: "#000000",
        colorNameFr: "Noir",
        colorNameAr: "أسود",
        colorNameEn: "Black",
        size: "M",
        stock: 2,
    }],
};
const otherProduct = {
    ...lowProduct,
    id: "444444444444444444444444",
    slug: "sac-fixture",
    nameFr: "Sac de recette",
    variants: [{ ...lowProduct.variants[0], id: "555555555555555555555555", sku: "SAC-OUT", stock: 0 }],
};
const order = {
    id: "666666666666666666666666",
    customerName: "Client à confirmer",
    customerPhone: "+212600000099",
    city: "Rabat",
    address: "Adresse fictive",
    status: "PENDING",
    paymentStatus: "PENDING",
    paymentMethod: "COD",
    totalAmount: 280,
    shippingCost: 0,
    createdAt: "2026-11-06T10:00:00Z",
    items: [],
};
async function navigate(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if (await menu.isVisible() && (await menu.getAttribute("aria-expanded")) === "false") await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}

for (const width of [390, 1440]) {
    test(`Admin tasks open the right queue and inventory preserves drafts at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem("adminToken", "isolated-operations");
            localStorage.setItem("imad-admin-language", "fr");
        });
        const writes: string[] = [];
        await page.route("**/api/**", async (route) => {
            const request = route.request();
            const { pathname } = new URL(request.url());
            if (request.method() !== "GET") {
                writes.push(pathname);
                return route.fulfill({ status: 405 });
            }
            const data = pathname === "/api/products/admin/catalog"
                ? [lowProduct, otherProduct]
                : pathname === "/api/categories"
                    ? [category]
                    : pathname === "/api/orders"
                        ? [order, { ...order, id: "777777777777777777777777", customerName: "Client à expédier", status: "CONFIRMED" }]
                        : [];
            return route.fulfill({ json: { success: true, data, total: data.length, unread: 0 } });
        });
        await page.goto("/admin");
        const task = page.locator(".admin-task-grid");
        await expect(task.getByRole("button", { name: /Commandes à confirmer.*1/ })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath("dashboard.png") });
        await task.getByRole("button", { name: /Commandes à expédier.*1/ }).click();
        await expect(page.getByText("Client à expédier", { exact: true })).toBeVisible();
        await expect(page.getByText("Client à confirmer", { exact: true })).toHaveCount(0);
        await page.getByRole("searchbox", { name: "Rechercher une commande" }).fill("ancien filtre");
        await navigate(page, "Vue d’ensemble");
        await task.getByRole("button", { name: /Commandes à confirmer.*1/ }).click();
        await expect(page.getByRole("searchbox", { name: "Rechercher une commande" })).toHaveValue("");
        await expect(page.getByText("Client à confirmer", { exact: true })).toBeVisible();
        await expect(page.getByText("Client à expédier", { exact: true })).toHaveCount(0);

        await navigate(page, "Produits");
        await page.getByRole("button", { name: "Modifier Abaya de recette", exact: true }).click();
        await page.getByLabel("Nom français", { exact: true }).fill("Brouillon conservé");
        await navigate(page, "Vue d’ensemble");
        await task.getByRole("button", { name: /Variantes en stock faible.*1/ }).click();
        const inventory = page.locator(".admin-inventory-list");
        await expect(inventory.getByText("ABAYA-LOW-M", { exact: true })).toBeVisible();
        await expect(inventory.getByText("SAC-OUT", { exact: true })).toHaveCount(0);
        const search = page.getByRole("searchbox", { name: "Rechercher dans le stock" });
        await search.fill("aucune correspondance");
        await expect(page.getByText("Aucune variante dans cette sélection.", { exact: true })).toBeVisible();
        await search.fill("LOW-M");
        await expect(inventory.getByText("ABAYA-LOW-M", { exact: true })).toBeVisible();
        await search.fill("");
        await page.getByRole("button", { name: /En rupture.*1/ }).click();
        await expect(inventory.getByText("SAC-OUT", { exact: true })).toBeVisible();
        await expect(inventory.getByText("ABAYA-LOW-M", { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath("stock.png") });
        await inventory.getByRole("button", { name: "Voir le produit Sac de recette" }).click();
        await expect(page).toHaveURL(url => url.searchParams.get("product") === otherProduct.id);
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Brouillon conservé");
        const list = page.locator(".admin-product-list");
        await expect(list.getByRole("heading", { name: "Sac de recette" })).toBeVisible();
        await expect(list.getByRole("heading", { name: "Abaya de recette" })).toHaveCount(0);
        await page.getByRole("button", { name: "Afficher tous les produits", exact: true }).click();
        await expect(list.getByRole("heading", { name: "Abaya de recette" })).toBeVisible();
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Brouillon conservé");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await navigate(page, "Stock");
        await page.getByRole("combobox", { name: "Langue de l’administration / لغة لوحة الإدارة" }).selectOption("ar");
        await expect(page.getByRole("heading", { name: "المخزون حسب الخيار", exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(writes).toEqual([]);
    });
}
