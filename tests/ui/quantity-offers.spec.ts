import { test, expect } from "@playwright/test";
for (const width of [390, 1440]) {
    test(`An exact dashboard price overrides repeated pairs at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 950 });
        await page.goto("/products/fixture-override");
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
        await expect(page.locator(".quantity-selection-total")).toContainText("650.00");
        await expect(page.getByLabel("تفصيل السعر حسب العروض", { exact: true })).toContainText(
            "1 × عرض 3 قطع",
        );
        await expect(page.getByLabel("تفصيل السعر حسب العروض", { exact: true })).not.toContainText(
            "بالسعر العادي",
        );
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("650.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.goto("/checkout");
        await expect(
            page
                .getByRole("complementary", { name: "ملخص الطلب", exact: true })
                .locator(".bag-grand-total"),
        ).toContainText("650.00");
    });
    test(`Pairs repeat and loose pieces retain the original price at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 950 });
        await page.goto("/products/fixture-manual");
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
        await expect(page.locator(".quantity-selection-total")).toContainText("630.00");
        await expect(page.locator(".quantity-selection-saving")).toContainText("60.00");
        await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
        await expect(page.locator(".quantity-selection-total")).toContainText("400.00");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("400.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await expect(page.locator(".quantity-selection-total")).toContainText("630.00");
        await expect(page.locator(".quantity-selection-summary")).toContainText(
            "2 في السلة + 1 للإضافة = 3",
        );
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("630.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.goto("/checkout");
        const summary = page.getByRole("complementary", { name: "ملخص الطلب", exact: true });
        await expect(summary.locator(".bag-grand-total")).toContainText("630.00");
        await page.reload();
        await expect(summary.locator(".bag-grand-total")).toContainText("630.00");
        await page.screenshot({
            path: info.outputPath(`manual-offer-${width}.png`),
            fullPage: true,
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
    test(`Quick quantity choices respect stock and explain existing basket totals at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 950 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/products/fixture-sabot");
        await page.getByRole("button", { name: "اختيار قطعتين", exact: true }).click();
        await expect(page.locator(".quantity-selection-total")).toContainText("460.00");
        await expect(page.locator(".quantity-selection-saving")).toHaveCount(0);
        await page.goto("/products/fixture-offer");
        const one = page.getByRole("button", { name: "اختيار قطعة واحدة", exact: true });
        const two = page.getByRole("button", { name: "اختيار قطعتين", exact: true });
        const three = page.getByRole("button", { name: "اختيار 3 قطع", exact: true });
        await expect(one).toHaveAttribute("aria-pressed", "true");
        await expect(three).toBeDisabled();
        await two.focus();
        await two.press("Enter");
        await expect(two).toHaveAttribute("aria-pressed", "true");
        await expect(one).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByLabel("الكمية", { exact: true })).toHaveValue("2");
        await expect(page.locator(".quantity-selection-total")).toContainText("400.00");
        await expect(page.locator(".quantity-selection-saving")).toContainText("60.00");
        await expect(page.locator(".purchase-price")).toContainText("400.00");
        await page.screenshot({ path: info.outputPath(`quantity-buttons-${width}.png`) });
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("400.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await expect(one).toBeDisabled();
        await expect(two).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "الكمية في السلة", exact: true }),
        ).toBeDisabled();
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await expect(three).toBeEnabled();
        await three.click();
        await expect(page.locator(".quantity-selection-total")).toContainText("1030.00");
        await expect(page.locator(".quantity-selection-saving")).toContainText("120.00");
        await expect(page.locator(".quantity-selection-summary")).toContainText(
            "2 في السلة + 3 للإضافة = 5",
        );
        await expect(page.locator(".purchase-price")).toContainText("1030.00");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog").locator(".bag-grand-total")).toContainText("1030.00");
        expect(errors).toEqual([]);
    });
    test(`Quantity offers combine colours and revert after removal at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 950 });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto("/products/fixture-offer");
        await expect(
            page.getByRole("button", { name: "اختيار قطعتين", exact: true }),
        ).toBeVisible();
        await expect(page.locator(".purchase-price")).toContainText("230.00");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("230.00");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await expect(page.locator(".purchase-price")).toContainText("400.00");
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
            if (
                (path === `/api/products/${product.id}` && req.method() === "PUT") ||
                (path === "/api/products" && req.method() === "POST")
            ) {
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
        await page.getByRole("button", { name: "Ajouter une offre", exact: true }).click();
        await expect(page.getByLabel("Quantité de l’offre", { exact: true })).toHaveValue("");
        await expect(page.getByLabel("Total du lot (MAD)", { exact: true })).toHaveValue("");
        await page.getByLabel("Quantité de l’offre", { exact: true }).fill("2");
        await expect(page.getByLabel("Total du lot (MAD)", { exact: true })).toHaveValue("");
        await page.getByLabel("Total du lot (MAD)", { exact: true }).fill("400");
        const enteredOffers = page.getByLabel("Offres saisies manuellement", { exact: true });
        await expect(enteredOffers.locator(".quantity-preview-grid > div")).toHaveCount(1);
        await expect(enteredOffers).toContainText("400,00");
        await expect(enteredOffers).not.toContainText("600,00");
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(
            page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true }),
        ).toBeVisible();
        expect(product.quantityDiscounts).toEqual([
            { minQuantity: 2, unitPrice: 200, totalPrice: 400 },
        ]);
        expect(writes).toBe(1);
        await page.getByRole("button", { name: "Modifier Article fictif", exact: true }).click();
        await expect(page.getByLabel("Total du lot (MAD)", { exact: true })).toHaveValue("400.00");
        await page.getByLabel("Total du lot (MAD)", { exact: true }).fill("500");
        // Native validation blocks a price above the normal price without sending a request.
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        expect(writes).toBe(1);
        await page.getByRole("button", { name: "Supprimer l’offre 1", exact: true }).click();
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(
            page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true }),
        ).toBeVisible();
        expect(product.quantityDiscounts).toEqual([]);
        expect(writes).toBe(2);
        await page.getByRole("button", { name: "Ajouter un produit", exact: true }).click();
        await page.getByLabel("Nom français", { exact: true }).fill("Nouveau sac");
        await page.getByLabel("Nom arabe", { exact: true }).fill("حقيبة تجريبية");
        await expect(page.getByLabel("Adresse du produit", { exact: true })).toHaveValue(
            "nouveau-sac",
        );
        await page.getByLabel("Catégorie du produit", { exact: true }).selectOption(category.id);
        await page.getByLabel("Prix de vente (MAD)", { exact: true }).fill("200");
        await expect(page.getByLabel("Offres saisies manuellement", { exact: true })).toHaveCount(
            0,
        );
        await expect(
            page.getByText(
                "Aucune promotion par quantité. Le prix normal de la pièce s’applique.",
                { exact: true },
            ),
        ).toBeVisible();
        await page.screenshot({
            path: `test-results/product-builder-${width}.png`,
            fullPage: true,
        });
        await page.getByRole("button", { name: "Enregistrer le produit", exact: true }).click();
        await expect(
            page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true }),
        ).toBeVisible();
        expect(writes).toBe(3);
        expect(product.status).toBe("DRAFT");
        expect(product.nameEn).toBe("Nouveau sac");
        expect(product.quantityDiscounts).toEqual([]);
        expect(product.variants[0].stock).toBe(0);
        expect(product.variants[0].sku).toMatch(/^NOUVEAU-SAC-/);

        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
}

for (const width of [390, 1440])
    test(`A pack of three keeps its exact total at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 950 });
        await page.goto("/products/fixture-pack");
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
        await expect(page.getByLabel("الكمية", { exact: true })).toHaveValue("3");
        await expect(page.locator(".quantity-selection-total")).toContainText("500.00");
        await expect(page.locator(".purchase-price")).toContainText("500.00");
        await page.getByRole("button", { name: "إضافة إلى السلة", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator(".bag-grand-total")).toContainText("500.00");
        await expect(dialog.locator(".bag-line-total")).toContainText("500.00");
        await expect(dialog.locator(".bag-unit-price")).toContainText("≈");
        await page.getByRole("button", { name: "إغلاق السلة", exact: true }).click();
        await page.goto("/checkout");
        const summary = page.getByRole("complementary", { name: "ملخص الطلب", exact: true });
        await expect(summary.locator(".bag-grand-total")).toContainText("500.00");
        await page.reload();
        await expect(summary.locator(".bag-grand-total")).toContainText("500.00");
    });
