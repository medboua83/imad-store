import { expect, test, type Page } from "@playwright/test";
import { productColorKey } from "@imad-store/shared";

const category = { id: "111111111111111111111111", slug: "abayas", nameFr: "Abayas", nameAr: "عبايات", nameEn: "Abayas" };
const images = Array.from({ length: 25 }, (_, index) => index === 16 ? "/images/preview-missing.webp"
    : `/images/catalogue-test/${index === 0 ? "sac" : index === 24 ? "chale" : "abaya"}.webp?preview=${index + 1}`);
const variants = [
    { id: "333333333333333333333331", sku: "PREVIEW-BLACK-M", color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", size: "M", stock: 5 },
    { id: "333333333333333333333332", sku: "PREVIEW-BROWN-L", color: "#804000", colorNameFr: "Marron", colorNameAr: "بني", colorNameEn: "Brown", size: "L", stock: 0 },
];
async function fixture(page: Page) {
    const writes: { path: string; body: Record<string, unknown> }[] = [];
    let product = {
        id: "222222222222222222222222", slug: "preview-fixture", status: "DRAFT", category,
        nameFr: "Produit de recette", nameAr: "منتج تجريبي", nameEn: "Fixture product",
        descriptionFr: "Description fictive", descriptionAr: "وصف تجريبي", descriptionEn: "Fixture description",
        price: 230, compareAtPrice: 280, freeShipping: true, quantityDiscounts: [], images, variants,
        colorPhotos: variants.map((variant, index) => ({ colorKey: productColorKey(variant), image: images[index ? 24 : 0] })),
    };
    await page.addInitScript(() => {
        localStorage.setItem("adminToken", "isolated-photo-preview");
        if (!localStorage.getItem("imad-admin-language")) localStorage.setItem("imad-admin-language", "fr");
    });
    await page.route("**/api/**", async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== "GET") {
            writes.push({ path, body: req.postDataJSON() });
            if (req.method() !== "PUT" || path !== `/api/products/${product.id}`) return route.fulfill({ status: 405 });
            product = { ...product, ...req.postDataJSON(), category };
            return route.fulfill({ json: { success: true, data: product } });
        }
        const data = path === "/api/categories" ? [category]
            : path === "/api/products/admin/catalog" ? [product] : [];
        await route.fulfill({ json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 } });
    });
    return writes;
}
for (const width of [320, 390, 1440]) {
    test(`Current product photos preview without publication or loss at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const writes = await fixture(page);
        await page.goto("/admin?tab=products");
        await page.getByRole("button", { name: "Modifier Produit de recette", exact: true }).click();
        await page.getByLabel("Nom français", { exact: true }).fill("Publication en préparation");
        await page.getByLabel("Nom arabe", { exact: true }).fill("عنوان المعاينة");
        const opener = page.getByRole("button", { name: "Prévisualiser le produit", exact: true });
        await opener.click();
        const dialog = page.getByRole("dialog", { name: "Prévisualisation du produit", exact: true });
        const photo = dialog.locator(".product-preview-photo img");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("heading", { name: "عنوان المعاينة", exact: true })).toBeVisible();
        await expect(dialog.getByText("Publication en préparation", { exact: true })).toBeVisible();
        await expect(dialog.locator(".product-preview-price")).toContainText("230");
        await expect(dialog.locator(".product-preview-price del")).toContainText("280");
        await expect(dialog.locator(".product-preview-position")).toHaveText("Couverture");
        await expect(photo).toHaveJSProperty("src", new URL(images[0], page.url()).href);
        await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
        await expect(dialog.getByRole("button", { name: /Prévisualiser la photo \d+$/, exact: true })).toHaveCount(25);
        await dialog.getByRole("button", { name: "Ordinateur", exact: true }).click();
        await expect(dialog.locator("article")).toHaveAttribute("data-layout", "desktop");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        const frame = await dialog.evaluate(el => ({ left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: innerWidth }));
        expect(frame.left).toBeGreaterThanOrEqual(7);
        expect(frame.right).toBeLessThanOrEqual(frame.width - 7);
        await page.screenshot({ path: info.outputPath("product-preview.png") });
        await dialog.getByRole("button", { name: "Prévisualiser la photo 25", exact: true }).click();
        await expect(dialog.getByRole("status")).toHaveText("25 / 25");
        await expect(photo).toHaveJSProperty("src", new URL(images[24], page.url()).href);
        await dialog.getByRole("button", { name: "Photo suivante", exact: true }).click();
        await expect(dialog.getByRole("status")).toHaveText("1 / 25");
        await dialog.getByRole("button", { name: "بني", exact: true }).click();
        await expect(photo).toHaveJSProperty("src", new URL(images[24], page.url()).href);
        await dialog.getByRole("button", { name: "Prévisualiser la photo 17", exact: true }).click();
        await expect(dialog.locator(".product-preview-photo").getByText("Photo indisponible", { exact: true })).toBeVisible();
        await page.keyboard.press("ArrowRight");
        await expect(dialog.getByRole("status")).toHaveText("18 / 25");
        await expect(photo).toHaveJSProperty("src", new URL(images[17], page.url()).href);
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(opener).toBeFocused();
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Publication en préparation");
        await expect(page.locator(".product-photo-grid .product-photo-card")).toHaveCount(25);
        expect(writes).toEqual([]);
        await page.getByRole("button", { name: "Prévisualiser les photos", exact: true }).click();
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Revenir à la fiche", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0].body.images).toEqual(images);
        expect(writes[0].body.status).toBe("DRAFT");
        expect(writes[0].body.colorPhotos).toEqual(variants.map((variant, index) => ({ colorKey: productColorKey(variant), image: images[index ? 24 : 0] })));
    });
}

test("Empty drafts can be previewed in Arabic without form validation or saving", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 750 });
    const writes = await fixture(page);
    await page.goto("/admin?tab=products");
    await page.getByRole("button", { name: "Ajouter un produit", exact: true }).click();
    await page.getByLabel("Langue de l’administration").selectOption("ar");
    await page.getByRole("button", { name: "معاينة المنتج", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("أضيفوا صورة لمشاهدة مظهرها هنا.", { exact: true })).toBeVisible();
    await expect(dialog.getByText("أدخلوا السعر", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("empty-preview-ar.png") });
    await dialog.getByRole("button", { name: "إغلاق المعاينة", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(writes).toEqual([]);
});

test("Leaving the product tab closes its preview and keeps the draft", async ({ page }) => {
    const writes = await fixture(page);
    await page.goto("/admin");
    await page.locator("#admin-navigation").getByRole("button", { name: "Produits", exact: true }).click();
    await page.getByRole("button", { name: "Modifier Produit de recette", exact: true }).click();
    await page.getByLabel("Nom français", { exact: true }).fill("Brouillon à conserver");
    await page.getByRole("button", { name: "Prévisualiser le produit", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await page.goForward();
    await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue("Brouillon à conserver");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(writes).toEqual([]);
});
