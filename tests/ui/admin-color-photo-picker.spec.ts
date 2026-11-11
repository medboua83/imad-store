import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const category = { id: "111111111111111111111111", slug: "mode", nameFr: "Mode", nameAr: "أزياء", nameEn: "Fashion" };
const images = Array.from({ length: 25 }, (_, index) => `/images/catalogue-test/${index === 0 ? "sac" : index === 24 ? "chale" : "abaya"}.webp?color=${index + 1}`);
const variants = [
    { id: "333333333333333333333331", sku: "BLACK-M", size: "M", stock: 5, color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black" },
    { id: "333333333333333333333332", sku: "BLACK-L", size: "L", stock: 4, color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black" },
    { id: "333333333333333333333333", sku: "BROWN-M", size: "M", stock: 2, color: "#804000", colorNameFr: "Marron", colorNameAr: "بني", colorNameEn: "Brown" },
];
async function fixture(page: Page, empty = false) {
    let product = { id: "222222222222222222222222", slug: "article-photo", nameFr: "Article photo", nameAr: "منتج الصور", nameEn: "Photo item", descriptionFr: "", descriptionAr: "", descriptionEn: "", category, status: "ACTIVE", price: 200, images, variants, colorPhotos: [] as { colorKey: string; image: string }[] };
    let uploads = 0;
    const writes: { method: string; data: typeof product }[] = [];
    await page.addInitScript(() => {
        localStorage.setItem("adminToken", "isolated-visual-color-photos");
        localStorage.setItem("imad-admin-language", "fr");
    });
    await page.route("**/api/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path === "/api/uploads" && request.method() === "POST") {
            return route.fulfill({ json: { success: true, data: { url: images[uploads++] } } });
        }
        if (request.method() !== "GET") {
            if (path !== `/api/products/${product.id}` && path !== "/api/products") return route.fulfill({ status: 405 });
            writes.push({ method: request.method(), data: request.postDataJSON() });
            product = { ...product, ...request.postDataJSON(), category };
            empty = false;
            return route.fulfill({ json: { success: true, data: product } });
        }
        const data = path === "/api/products/admin/catalog" ? empty ? [] : [product] : path === "/api/categories" ? [category] : [];
        return route.fulfill({ json: { success: true, data, total: data.length, unread: 0 } });
    });
    return { writes, get product() { return product; }, get uploads() { return uploads; } };
}
for (const width of [320, 390, 1440]) {
    test(`Visual color associations and renamed colors stay correct at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const state = await fixture(page);
        await page.goto("/admin?tab=products");
        await page.getByRole("button", { name: "Modifier Article photo", exact: true }).click();
        const editor = page.locator("#product-color-photos");
        const card = (name: string) => editor.getByRole("region", { name: `Photo pour ${name}`, exact: true });
        await expect(editor.locator(".color-photo-card")).toHaveCount(2);
        await expect(editor.getByRole("status")).toHaveText("0 sur 2 couleurs avec une photo");
        expect(await editor.evaluate(el => el.getBoundingClientRect().top < document.querySelector("#product-variants")!.getBoundingClientRect().top)).toBe(true);
        await card("Noir").getByRole("button", { name: "Choisir une photo pour Noir", exact: true }).click();
        await expect(card("Noir").locator(".color-photo-choice-grid > button")).toHaveCount(25);
        await card("Noir").getByRole("button", { name: "Associer la photo 2 à Noir", exact: true }).click();
        await expect(card("Noir").getByText("Photo 2 associée", { exact: true })).toBeVisible();
        await card("Noir").getByRole("button", { name: "Associer la photo 2 à Noir", exact: true }).press("Escape");
        await expect(card("Noir").getByRole("button", { name: "Choisir une photo pour Noir", exact: true })).toBeFocused();
        await page.getByRole("button", { name: "Prévisualiser le produit", exact: true }).click();
        const preview = page.getByRole("dialog", { name: "Prévisualisation du produit", exact: true });
        const photo = preview.locator(".product-preview-photo img");
        await preview.getByRole("button", { name: "أسود", exact: true }).click();
        await expect(photo).toHaveJSProperty("src", new URL(images[1], page.url()).href);
        await preview.getByRole("button", { name: "بني", exact: true }).click();
        await expect(preview.getByText("Cette couleur n’a pas de photo associée. Choisissez-la dans Photos et couleurs.", { exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        expect(state.writes).toEqual([]);
        await card("Marron").getByRole("button", { name: "Choisir une photo pour Marron", exact: true }).click();
        await card("Marron").getByRole("button", { name: "Associer la photo 25 à Marron", exact: true }).click();
        await card("Marron").getByRole("button", { name: "Fermer le choix de photo pour Marron", exact: true }).click();
        await expect(card("Marron").getByRole("button", { name: "Choisir une photo pour Marron", exact: true })).toBeFocused();
        await page.getByLabel("Couleur français", { exact: true }).nth(0).fill("Ébène");
        await page.getByLabel("Couleur français", { exact: true }).nth(1).fill("Ébène");
        await expect(card("Ébène").getByText("Photo 2 associée", { exact: true })).toBeVisible();
        // A genuinely different swatch cannot silently inherit the former color's picture.
        await page.getByLabel("Code couleur de la variante 1", { exact: true }).fill("#111111");
        await page.getByLabel("Code couleur de la variante 2", { exact: true }).fill("#111111");
        await expect(card("Ébène").getByText("Photo à associer", { exact: true })).toBeVisible();
        await card("Ébène").getByRole("button", { name: "Choisir une photo pour Ébène", exact: true }).click();
        await card("Ébène").getByRole("button", { name: "Associer la photo 1 à Ébène", exact: true }).click();
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true })).toBeVisible();
        expect(state.writes).toHaveLength(1);
        expect(state.product.colorPhotos).toEqual(expect.arrayContaining([
            { colorKey: "#111111|ébène", image: images[0] }, { colorKey: "#804000|marron", image: images[24] },
        ]));
        expect(state.product.colorPhotos).toHaveLength(2);
        expect(state.product.images).toEqual(images);
        expect(state.product.variants.map(v => v.stock)).toEqual([5, 4, 2]);
        await page.getByRole("button", { name: "Modifier Article photo", exact: true }).click();
        await card("Marron").getByRole("button", { name: "Choisir une photo pour Marron", exact: true }).click();
        await card("Marron").getByRole("button", { name: "Associer la photo 25 à Marron", exact: true }).click();
        await expect(page.getByText("Fiche chargée", { exact: true })).toBeVisible();
        await card("Marron").getByRole("button", { name: "Effacer l’association de Marron", exact: true }).click();
        await expect(card("Marron").getByRole("button", { name: "Choisir une photo pour Marron", exact: true })).toBeFocused();
        await expect(card("Marron").getByText("Photo à associer", { exact: true })).toBeVisible();
        expect(state.writes).toHaveLength(1);
        await page.getByLabel("Langue de l’administration / لغة لوحة الإدارة").selectOption("ar");
        await page.getByRole("button", { name: "اختيار صورة للون أسود", exact: true }).click();
        await editor.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`color-picker-${width}.png`) });
    });
}

test("A new draft can upload photos and link its initial color before its first save", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const state = await fixture(page, true);
    await page.goto("/admin?tab=products");
    await page.getByRole("button", { name: "Ajouter un produit", exact: true }).click();
    const editor = page.locator("#product-color-photos");
    const opener = editor.getByRole("button", { name: "Choisir une photo pour Noir", exact: true });
    await expect(opener).toBeDisabled();
    await page.locator('.product-photo-drop input[type="file"]').setInputFiles([
        resolve("apps/web/public/images/catalogue-test/sac.webp"), resolve("apps/web/public/images/catalogue-test/abaya.webp"),
    ]);
    await expect(opener).toBeEnabled();
    expect(state.uploads).toBe(2);
    await opener.click();
    await editor.getByRole("button", { name: "Associer la photo 2 à Noir", exact: true }).click();
    await page.getByRole("button", { name: "Ajouter une variante", exact: true }).click();
    await page.getByLabel("Couleur français", { exact: true }).nth(1).fill("Rouge");
    await expect(editor.getByRole("region", { name: "Photo pour Rouge", exact: true }).getByText("Photo à associer", { exact: true })).toBeVisible();
    await expect(editor.getByRole("region", { name: "Photo pour Noir", exact: true }).getByText("Photo 2 associée", { exact: true })).toBeVisible();
    await page.getByLabel("Nom français", { exact: true }).fill("Nouveau produit photos");
    await page.getByLabel("Nom arabe", { exact: true }).fill("منتج جديد");
    await page.getByLabel("Catégorie du produit", { exact: true }).selectOption(category.id);
    await page.getByLabel("Prix de vente (MAD)", { exact: true }).fill("200");
    expect(state.writes).toEqual([]);
    await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0].method).toBe("POST");
    expect(state.product.status).toBe("DRAFT");
    expect(state.product.colorPhotos).toEqual([{ colorKey: "#000000|noir", image: images[1] }]);
});
