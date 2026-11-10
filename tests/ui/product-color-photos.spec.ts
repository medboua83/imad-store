import { test, expect } from "@playwright/test";

const images = ["sac", "abaya", "chale"].map((name) => `/images/catalogue-test/${name}.webp`);

for (const width of [390, 1440]) {
    test(`Product colors change the active photo on a ${width}px screen`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/products/fixture-color-photos");
        const photo = page.locator(".gallery-stage img");
        const color = (name: string) => page.getByRole("button", { name, exact: true });
        const show = (index: number) => expect(photo).toHaveAttribute("src", images[index]);

        await show(2);
        await color("بني").click();
        await show(1);
        await expect(color("44")).toHaveAttribute("aria-pressed", "true");
        await expect(color("عرض الصورة 2")).toHaveAttribute("aria-pressed", "true");
        await color("45").click();
        await show(1);
        await color("أزرق").click();
        await show(0);
        await color("أسود").press("Enter");
        await show(2);
        await color("تكبير صورة المنتج").click();
        await expect(page.locator(".gallery-dialog img")).toHaveAttribute("src", images[2]);
        await page.keyboard.press("Escape");
        await page.goto("/products/fixture-color-photos?size=44");
        await show(1);
        await expect(color("بني")).toHaveAttribute("aria-pressed", "true");
    });
}

test("The dashboard saves one photo for all sizes of a color and clears removed photos", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const category = { id: "111111111111111111111111", slug: "clothes", nameFr: "Mode", nameAr: "أزياء", nameEn: "Clothes" };
    const productId = "222222222222222222222222";
    const variants = ["40", "44"].map((size) => ({
        id: `3333333333333333333333${size}`, size, sku: `TEST-${size}`, stock: 5,
        color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black",
    }));
    let product = {
        id: productId, slug: "article-couleurs", nameFr: "Article couleurs", nameAr: "منتج", nameEn: "Product",
        descriptionFr: "", descriptionAr: "", descriptionEn: "", price: 230, status: "ACTIVE",
        category, images, variants, colorPhotos: [] as { colorKey: string; image: string }[],
    };
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-color-photo-test"));
    await page.route("**/api/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === `/api/products/${productId}` && request.method() === "PUT")
            product = { ...product, ...request.postDataJSON(), category, variants };
        else if (request.method() !== "GET") return route.fulfill({ status: 405 });
        const data = path === "/api/products/admin/catalog" ? [product] : path === "/api/categories" ? [category] : [];
        return route.fulfill({ json: { success: true, data, total: data.length } });
    });
    await page.goto("/admin?tab=products");
    const edit = page.getByRole("button", { name: "Modifier Article couleurs", exact: true });
    const save = page.getByRole("button", { name: "Enregistrer le produit", exact: true });
    const saved = page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true });
    const picker = page.getByRole("combobox", { name: "Photo pour Noir", exact: true });
    await edit.click();
    await expect(picker).toHaveCount(1);
    await picker.selectOption(images[1]);
    await save.click();
    await expect(saved).toBeVisible();
    expect(product.colorPhotos).toEqual([{ colorKey: "#000000|noir", image: images[1] }]);
    await edit.click();
    await expect(picker).toHaveValue(images[1]);
    await page.getByRole("button", { name: "Retirer la photo 2", exact: true }).click();
    await expect(picker).toHaveValue("");
    await save.click();
    await expect(saved).toBeVisible();
    expect(product.colorPhotos).toEqual([]);
});
