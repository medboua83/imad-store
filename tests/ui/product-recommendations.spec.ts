import { test, expect } from "@playwright/test";

for (const width of [390, 1366]) {
    test(`Alternatives and complements preserve the basket and require a variant choice at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto("/products/fixture-recommendations");
        const alternatives = page.getByRole("region", { name: "خيارات أخرى للمقارنة", exact: true });
        const complements = page.getByRole("region", { name: "أكملوا اختياراتكم", exact: true });
        await expect(alternatives).toContainText("300.00");
        await expect(complements).toContainText("50.00");
        await expect(complements.getByRole("button")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "فتح السلة، 0 قطعة", exact: true })).toBeVisible();
        await alternatives.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`recommendations-${width}.png`) });
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
        await expect(dialog.locator(".recommendation-card")).toHaveCount(1);
        await expect(dialog).not.toContainText("موديل للمقارنة");
        await dialog.getByRole("link", { name: "اختيار خيارات قطعة مكملة تجريبية", exact: true }).click();
        await expect(page).toHaveURL(/\/products\/fixture-accessory$/);
        await expect(page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "قطعة مكملة تجريبية", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(dialog.locator(".bag-grand-total")).toContainText("280.00");
        await expect(dialog.locator(".recommendation-card")).toHaveCount(0);
        await dialog.getByRole("button", { name: "حذف قطعة مكملة تجريبية", exact: true }).click();
        await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
        await expect(dialog.locator(".recommendation-card")).toHaveCount(1);
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.goto("/products/fixture-second-source");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(dialog.locator(".bag-grand-total")).toContainText("310.00");
        await expect(dialog.locator(".recommendation-card")).toHaveCount(2);
        await expect(dialog.getByRole("link", { name: "اختيار خيارات قطعة مكملة تجريبية", exact: true })).toHaveCount(1);
        await expect(dialog.getByRole("link", { name: "اختيار خيارات صابو تجريبي", exact: true })).toHaveCount(0);
        await page.screenshot({ path: info.outputPath(`cart-complements-${width}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
    });
}

test("Recommendations failing to load never prevent continuing checkout", async ({ page }) => {
    await page.route("**/api/products/*/recommendations", route => route.fulfill({ status: 503, json: { success: false } }));
    await page.goto("/products/fixture-recommendations");
    await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".bag-grand-total")).toContainText("230.00");
    await expect(dialog.getByRole("link", { name: "متابعة الطلب", exact: true })).toBeVisible();
    await expect(dialog.locator(".recommendation-card")).toHaveCount(0);
});

for (const width of [390, 1366]) {
    test(`Administrator saves, reopens and disables recommendations at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const category = { id: "111111111111111111111111", slug: "bags", nameFr: "Sacs", nameAr: "حقائب", nameEn: "Bags" };
        const base: any = { id: "222222222222222222222222", slug: "admin-source", nameFr: "Article source", nameAr: "منتج", nameEn: "Product", descriptionFr: "", descriptionAr: "", descriptionEn: "", price: 230, status: "ACTIVE", category, images: ["/images/catalogue-test/sac.webp"], variants: [{ id: "333333333333333333333333", sku: "SOURCE", color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", size: "40", stock: 5 }] };
        const target = { ...base, id: "444444444444444444444444", slug: "admin-target", nameFr: "Complément choisi", price: 50, variants: [{ ...base.variants[0], id: "555555555555555555555555", sku: "TARGET" }] };
        let writes = 0;
        await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-recommendations-test"));
        await page.route("**/api/**", async route => {
            const req = route.request(), url = new URL(req.url());
            let data: any = [];
            if (url.pathname === "/api/categories") data = [category];
            if (url.pathname === "/api/products/admin/catalog") {
                const ids = url.searchParams.get("ids")?.split(",");
                data = [base, target].filter(p => !ids || ids.includes(p.id));
            }
            if (url.pathname === `/api/products/${base.id}` && req.method() === "PUT") {
                Object.assign(base, req.postDataJSON()); data = base; writes++;
            }
            await route.fulfill({ json: { success: true, data, total: 2, page: 1, totalPages: 1, unread: 0 } });
        });
        await page.goto("/admin");
        if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
        await page.getByRole("button", { name: "Produits", exact: true }).click();
        await page.getByRole("button", { name: "Modifier Article source", exact: true }).click();
        const enable = page.getByLabel("Activer les recommandations de ce produit", { exact: true });
        await expect(enable).not.toBeChecked();
        await expect(page.getByLabel("Article source — Produits complémentaires", { exact: true })).toHaveCount(0);
        await enable.check();
        await page.getByLabel("Complément choisi — Produits complémentaires", { exact: true }).check();
        await page.getByLabel("Complément choisi — Alternatives / montée en gamme", { exact: true }).check();
        await page.locator("#product-recommendations").scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`admin-recommendations-${width}.png`) });
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true })).toBeVisible();
        expect(base.recommendationSettings).toEqual({ enabled: true, upsellProductIds: [target.id], crossSellProductIds: [target.id] });
        await page.reload();
        if (width < 768) await page.getByRole("button", { name: "Navigation", exact: true }).click();
        await page.getByRole("button", { name: "Produits", exact: true }).click();
        await page.getByRole("button", { name: "Modifier Article source", exact: true }).click();
        await expect(enable).toBeChecked();
        await expect(page.getByLabel("Complément choisi — Produits complémentaires", { exact: true })).toBeChecked();
        await enable.uncheck();
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true })).toBeVisible();
        expect(base.recommendationSettings.enabled).toBe(false);
        expect(base.recommendationSettings.crossSellProductIds).toEqual([target.id]);
        expect(writes).toBe(2);
        expect(base.price).toBe(230);
        expect(base.variants[0].stock).toBe(5);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}
