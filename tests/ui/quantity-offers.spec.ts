import { test, expect } from "@playwright/test";
for (const width of [390, 1440]) {
    test(`Quantity offers combine colours and revert after removal at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 950 });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto("/products/fixture-offer");
        await expect(page.getByRole("region", { name: "عروض الكمية" })).toContainText("200.00");
        await expect(page.locator(".purchase-price")).toContainText("230.00");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("230.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await expect(page.locator(".purchase-price")).toContainText("200.00");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator(".bag-grand-total")).toContainText("400.00");
        await expect(dialog.locator(".bag-totals .quantity-saving")).toContainText("60.00");
        await page.screenshot({
            path: info.outputPath(`quantity-cart-${width}.png`),
            fullPage: true,
        });
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.goto("/checkout");
        const summary = page.getByRole("complementary", { name: "ملخص الطلب", exact: true });
        await expect(summary.locator(".bag-grand-total")).toContainText("400.00");
        await expect(summary.locator(".bag-unit-price del")).toHaveCount(2);
        await page.reload();
        await expect(summary.locator(".bag-grand-total")).toContainText("400.00");
        await page.getByText("عرض وتعديل المنتجات", { exact: true }).click();
        await summary.getByRole("button", { name: "حذف صابو تجريبي", exact: true }).last().click();
        await expect(summary.locator(".bag-grand-total")).toContainText("230.00");
        await expect(summary.locator(".bag-totals .quantity-saving")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        expect(errors).toEqual([]);
    });
    test(`Admin saves, reloads and removes quantity tiers at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 950 });
        const category = {
            id: "111111111111111111111111",
            slug: "bags",
            nameFr: "Sacs",
            nameAr: "حقائب",
            nameEn: "Bags",
        };
        const product: any = {
            id: "222222222222222222222222",
            slug: "admin-offer",
            nameFr: "Article fictif",
            nameAr: "منتج تجريبي",
            nameEn: "Fixture product",
            descriptionFr: "",
            descriptionAr: "",
            descriptionEn: "",
            price: 230,
            category,
            status: "ACTIVE",
            images: ["/images/catalogue-test/sac.webp"],
            variants: [
                {
                    id: "333333333333333333333333",
                    sku: "FIXTURE",
                    color: "#000000",
                    colorNameFr: "Noir",
                    colorNameAr: "أسود",
                    colorNameEn: "Black",
                    size: "40",
                    stock: 5,
                },
            ],
        };
        let writes = 0;
        await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-ui-fixture"));
        await page.route("**/api/**", async (route) => {
            const req = route.request(),
                path = new URL(req.url()).pathname;
            let data: any = [];
            if (path === "/api/products/admin/catalog") data = [product];
            if (path === "/api/categories") data = [category];
            if (path === `/api/products/${product.id}` && req.method() === "PUT") {
                Object.assign(product, req.postDataJSON());
                data = product;
                writes++;
            }
            await route.fulfill({
                json: { success: true, data, total: 1, page: 1, totalPages: 1, unread: 0 },
            });
        });
        await page.goto("/admin");
        if (width < 768)
            await page.getByRole("button", { name: "Navigation", exact: true }).click();
        await page.getByRole("button", { name: "Produits", exact: true }).click();
        await page.getByRole("button", { name: "Modifier Article fictif", exact: true }).click();
        await page.getByRole("button", { name: "Ajouter un palier", exact: true }).click();
        await page.getByLabel("Dès (articles)", { exact: true }).fill("2");
        await page.getByLabel("Prix par article (MAD)", { exact: true }).fill("200");
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(
            page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true }),
        ).toBeVisible();
        expect(product.quantityDiscounts).toEqual([{ minQuantity: 2, unitPrice: 200 }]);
        expect(writes).toBe(1);
        await page.getByRole("button", { name: "Modifier Article fictif", exact: true }).click();
        await expect(page.getByLabel("Prix par article (MAD)", { exact: true })).toHaveValue("200");
        await page.getByLabel("Prix par article (MAD)", { exact: true }).fill("250");
        // Native validation blocks a price above the normal price without sending a request.
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        expect(writes).toBe(1);
        await page.getByRole("button", { name: "Supprimer le palier 1", exact: true }).click();
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(
            page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true }),
        ).toBeVisible();
        expect(product.quantityDiscounts).toEqual([]);
        expect(writes).toBe(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
}
