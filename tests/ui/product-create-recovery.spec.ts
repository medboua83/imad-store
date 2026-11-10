import { expect, test } from "@playwright/test";

for (const scenario of ["missing", "saved", "late"] as const) {
    test(`An uncertain product save recovers on mobile when the product is ${scenario}`, async ({ page }) => {
        const category = {
            id: "111111111111111111111111",
            slug: "abayas",
            nameFr: "Abayas",
            nameAr: "عبايات",
            nameEn: "Abayas",
        };
        const slug = "abaya-de-recette";
        const checks: string[] = [];
        const writes: Record<string, unknown>[] = [];
        let existing: Record<string, unknown> | null = null;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.setItem("adminToken", "isolated-product-recovery");
            localStorage.setItem("imad-admin-language", "fr");
        });
        await page.route("**/api/**", async (route) => {
            const request = route.request();
            const { pathname } = new URL(request.url());
            if (pathname === "/api/products" && request.method() === "POST") {
                const body = request.postDataJSON();
                writes.push(body);
                const saved = {
                    ...body,
                    id: "222222222222222222222222",
                    category,
                    variants: body.variants.map((variant: Record<string, unknown>) => ({
                        ...variant,
                        id: "333333333333333333333333",
                    })),
                };
                if (writes.length === 1) {
                    if (scenario !== "missing") existing = saved;
                    return scenario === "saved" ? route.fulfill({ status: 504 }) : route.abort("failed");
                }
                if (existing) return route.fulfill({ status: 409, json: { code: "PRODUCT_SLUG_CONFLICT" } });
                existing = saved;
                return route.fulfill({ status: 201, json: { success: true, data: existing } });
            }
            if (request.method() !== "GET") return route.fulfill({ status: 405 });
            if (pathname.startsWith("/api/products/admin/catalog/")) {
                checks.push(pathname);
                if (scenario === "missing" && checks.length === 1) return route.abort("failed");
                const data = scenario === "late" && checks.length === 1 ? null : existing;
                return route.fulfill({ json: { success: true, data } });
            }
            const data = pathname === "/api/categories" ? [category]
                : pathname === "/api/products/admin/catalog" && existing ? [existing]
                : [];
            return route.fulfill({ json: { success: true, data, total: data.length, unread: 0 } });
        });
        await page.goto("/admin?tab=products");
        await page.getByRole("button", { name: "Ajouter un produit", exact: true }).click();
        const name = page.getByLabel("Nom français", { exact: true });
        const address = page.getByLabel("Adresse du produit", { exact: true });
        const price = page.getByLabel("Prix de vente (MAD)", { exact: true });
        const stock = page.getByLabel("Stock disponible de la variante 1", { exact: true });
        const footer = page.locator(".product-editor-footer");
        const save = footer.getByRole("button", { name: "Enregistrer le produit", exact: true });
        const verify = footer.getByRole("button", { name: "Vérifier l’enregistrement", exact: true });
        await name.fill("Abaya de recette");
        await page.getByLabel("Nom arabe", { exact: true }).fill("عباية تجريبية");
        await page.getByLabel("Catégorie du produit", { exact: true }).selectOption(category.id);
        await price.fill("280");
        await stock.fill("3");
        await save.click();
        await expect(footer.getByText(/Enregistrement non confirmé/)).toBeVisible();
        await expect(save).toBeDisabled();
        await expect(address).not.toBeEditable();
        await verify.click();
        if (scenario === "missing") {
            await expect(footer.getByText(/Vérification impossible/)).toBeVisible();
            await expect(save).toBeDisabled();
            await verify.click();
        }
        if (scenario !== "saved") {
            await expect(footer.getByText(/Aucune fiche trouvée/)).toBeVisible();
            await expect(save).toBeEnabled();
        }
        await expect(name).toHaveValue("Abaya de recette");
        await expect(price).toHaveValue("280");
        await expect(stock).toHaveValue("3");
        await expect(address).toHaveValue(slug);

        if (scenario === "missing") {
            await name.fill("Abaya de recette corrigée");
            await expect(address).toHaveValue(slug);
            await save.click();
            await expect(page.getByText("Produit enregistré. Le catalogue est à jour.", { exact: true })).toBeVisible();
            expect(writes).toEqual([writes[0], { ...writes[0], nameFr: "Abaya de recette corrigée", nameEn: "Abaya de recette corrigée" }]);
        } else {
            if (scenario === "late") {
                await page.getByRole("button", { name: "Actualiser", exact: true }).click();
                await expect(page.getByRole("heading", { name: "Abaya de recette", level: 3 })).toBeVisible();
                await save.click();
                await expect(save).toBeDisabled();
                await verify.click();
            }
            await expect(footer.getByText(/Une fiche existe déjà/)).toBeVisible();
            await expect(save).toBeDisabled();
            await expect(name).toHaveValue("Abaya de recette");
            const open = footer.getByRole("button", { name: "Ouvrir la fiche existante", exact: true });
            page.once("dialog", (dialog) => dialog.dismiss());
            await open.click();
            await expect(save).toBeDisabled();
            await expect(price).toHaveValue("280");
            page.once("dialog", (dialog) => dialog.accept());
            await open.click();
            await expect(page.getByRole("heading", { name: "Modifier le produit", exact: true })).toBeVisible();
            await expect(save).toBeEnabled();
            expect(writes).toHaveLength(scenario === "late" ? 2 : 1);
        }
        expect(writes.every((body) => body.slug === slug)).toBe(true);
        expect(checks).toEqual(Array(scenario === "saved" ? 1 : 2).fill(`/api/products/admin/catalog/${slug}`));
    });
}
