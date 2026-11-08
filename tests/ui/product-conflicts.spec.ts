import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
    test(`Product address and fourth-variant SKU conflicts preserve the draft at ${width}px`, async ({
        page,
    }, info) => {
        const ar = width === 390;
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((ar) => {
            localStorage.setItem("adminToken", "isolated-product-conflicts");
            localStorage.setItem("imad-admin-language", ar ? "ar" : "fr");
        }, ar);
        const category = {
            id: "111111111111111111111111",
            slug: "coats",
            nameFr: "Manteaux",
            nameAr: "معاطف",
            nameEn: "Coats",
        };
        const existing = {
            id: "222222222222222222222222",
            slug: "manteau-test",
            nameFr: "Manteau test",
            nameAr: "معطف اختبار",
            nameEn: "Test coat",
            descriptionFr: "",
            descriptionAr: "",
            descriptionEn: "",
            price: 230,
            status: "DRAFT",
            images: [],
            category,
            variants: [
                {
                    id: "333333333333333333333333",
                    sku: "manteau noir xxl",
                    color: "#000000",
                    colorNameFr: "Noir",
                    colorNameAr: "أسود",
                    colorNameEn: "Black",
                    size: "XXL",
                    stock: 4,
                },
            ],
        };
        const products: any[] = [existing],
            writes: any[] = [];
        await page.route("**/api/**", async (route) => {
            const req = route.request(),
                path = new URL(req.url()).pathname;
            if (req.method() === "POST" && path === "/api/products") {
                const body = req.postDataJSON();
                writes.push(body);
                if (writes.length === 1)
                    return route.fulfill({
                        status: 409,
                        json: {
                            success: false,
                            code: "PRODUCT_SLUG_CONFLICT",
                            error: "Cette adresse de produit existe déjà. Modifiez l’adresse ou ouvrez la fiche existante pour ajouter une couleur ou une taille.",
                        },
                    });
                products.push({
                    ...body,
                    id: "888888888888888888888888",
                    category,
                    variants: body.variants.map((v: any, i: number) => ({
                        ...v,
                        id: String(i + 1).padStart(24, "7"),
                    })),
                });
                return route.fulfill({
                    status: 201,
                    json: { success: true, data: products.at(-1) },
                });
            }
            if (req.method() !== "GET") return route.fulfill({ status: 405 });
            const data =
                path === "/api/products/admin/catalog"
                    ? products
                    : path === "/api/categories"
                      ? [category]
                      : [];
            return route.fulfill({
                json: {
                    success: true,
                    data,
                    total: Array.isArray(data) ? data.length : 0,
                    unread: 0,
                },
            });
        });
        await page.goto("/admin?tab=products");
        await page
            .getByRole("button", { name: ar ? "إضافة منتج" : "Ajouter un produit", exact: true })
            .click();
        const name = page.getByLabel(ar ? "الاسم الفرنسي" : "Nom français", { exact: true });
        const address = page.getByLabel(ar ? "رابط المنتج" : "Adresse du produit", { exact: true });
        const save = page.getByRole("button", {
            name: ar ? "حفظ المنتج" : "Enregistrer le produit",
            exact: true,
        });
        await name.fill("Manteau test");
        await page.getByLabel(ar ? "الاسم العربي" : "Nom arabe", { exact: true }).fill("معطف جديد");
        await page
            .getByLabel(ar ? "فئة المنتج" : "Catégorie du produit", { exact: true })
            .selectOption(category.id);
        await page
            .getByLabel(ar ? "سعر البيع (MAD)" : "Prix de vente (MAD)", { exact: true })
            .fill("200");
        await save.click();
        await expect(address).toBeFocused();
        await expect(address).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByRole("alert").first()).toContainText(ar ? "الرابط" : "L’adresse");
        expect(writes).toHaveLength(0);
        await address.fill("manteau-noir-test");
        await expect(page.getByRole("alert")).toHaveCount(0);
        for (let i = 0; i < 3; i++)
            await page
                .getByRole("button", {
                    name: ar ? "إضافة خيار" : "Ajouter une variante",
                    exact: true,
                })
                .click();
        const skus = page.getByLabel(ar ? "مرجع SKU" : "Référence SKU", { exact: true });
        await skus.nth(3).fill("manteau noir xxl");
        await save.click();
        await expect(skus.nth(3)).toBeFocused();
        await expect(skus.nth(3)).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByRole("alert").first()).toContainText("manteau noir xxl");
        await expect(page.getByRole("alert").first()).toContainText("Manteau test");
        expect(writes).toHaveLength(0);
        await page.screenshot({ path: info.outputPath(`sku-conflict-${width}.png`) });
        await skus.nth(3).fill("");
        await save.click();
        await expect.poll(() => writes.length).toBe(1);
        await expect(address).toBeFocused();
        await expect(page.getByRole("alert").first()).toContainText(
            ar ? "رابط المنتج مستخدم" : "Cette adresse de produit existe déjà",
        );
        await expect(name).toHaveValue("Manteau test");
        expect(writes[0].variants).toHaveLength(4);
        expect(new Set(writes[0].variants.map((v: any) => v.sku)).size).toBe(4);
        await address.fill("manteau-noir-autre-test");
        await save.click();
        await expect(
            page
                .getByRole("status")
                .filter({ hasText: ar ? "حُفظ المنتج" : "Produit enregistré." }),
        ).toBeVisible();
        expect(writes).toHaveLength(2);
        expect(products).toHaveLength(2);
        expect(existing.variants[0].stock).toBe(4);
    });
}
