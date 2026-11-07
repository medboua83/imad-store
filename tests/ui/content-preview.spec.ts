import { test, expect, type Page } from "@playwright/test";
import { defaultSiteContent } from "@imad-store/shared";

async function editor(
    page: Page,
    options: { holdSave?: Promise<void>; failReadback?: boolean } = {},
) {
    let content = { ...defaultSiteContent },
        revision = 1,
        saved = false;
    const writes: string[] = [];
    const category = {
        id: "111111111111111111111111",
        slug: "mens-clogs",
        nameFr: "Sabots",
        nameAr: "صابو",
        nameEn: "Clogs",
        publishedCount: 1,
    };
    const product = {
        id: "222222222222222222222222",
        slug: "preview-only",
        nameFr: "Article fictif",
        nameAr: "منتج المعاينة",
        nameEn: "Preview item",
        descriptionFr: "",
        descriptionAr: "",
        descriptionEn: "",
        category,
        price: 230,
        status: "ACTIVE",
        images: ["/images/catalogue-test/sac.webp"],
        variants: [
            {
                id: "333333333333333333333333",
                sku: "PREVIEW",
                color: "#000000",
                colorNameFr: "Noir",
                colorNameAr: "أسود",
                colorNameEn: "Black",
                size: "40",
                stock: 5,
            },
        ],
    };
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-content-preview"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            path = new URL(request.url()).pathname;
        if (request.method() !== "GET") {
            writes.push(path);
            if (path !== "/api/content/draft") return route.fulfill({ status: 405 });
            await options.holdSave;
            content = request.postDataJSON().content;
            revision++;
            saved = true;
            return route.fulfill({ json: { success: true } });
        }
        if (path === "/api/content/admin" && saved && options.failReadback)
            return route.fulfill({ status: 503 });
        const data =
            path === "/api/content/admin"
                ? { draft: content, published: defaultSiteContent, revision, canRollback: false }
                : path === "/api/products" || path === "/api/products/admin/catalog"
                  ? [product]
                  : path === "/api/categories"
                    ? [category]
                    : [];
        await route.fulfill({
            json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 },
        });
    });
    await page.goto("/admin?tab=content");
    await expect(page.getByLabel("Titre d’accueil", { exact: true })).toHaveValue(
        defaultSiteContent.heroTitle,
    );
    return writes;
}

for (const width of [390, 1440]) {
    test(`Content preview shows actual public merchandise and keeps its draft at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const writes = await editor(page);
        await page.getByLabel("Titre d’accueil", { exact: true }).fill("معاينة غير منشورة");
        await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
        const preview = page.locator(".admin-content-panel section:has(.storefront-home)");
        await expect(
            preview.getByRole("heading", { name: "معاينة غير منشورة", exact: true }),
        ).toBeVisible();
        await expect(preview.locator(".catalog-card")).toContainText("منتج المعاينة");
        await expect(
            preview.getByText("مجموعتنا الجديدة قيد التحضير.", { exact: true }),
        ).toHaveCount(0);
        for (const link of await preview.locator('a:not([href^="#"])').all()) {
            await expect(link).toHaveAttribute("target", "_blank");
            await expect(link).toHaveAttribute("rel", /noopener/);
        }
        expect(
            await preview.locator(".hero-photo").evaluate((el) => getComputedStyle(el).objectFit),
        ).toBe("contain");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
        await expect(page.getByLabel("Titre d’accueil", { exact: true })).toHaveValue(
            "معاينة غير منشورة",
        );
        expect(writes).toEqual([]);
        await page.screenshot({ path: info.outputPath(`content-preview-${width}.png`) });
    });
}

test("Saving content blocks edits and duplicate actions until the authoritative readback", async ({
    page,
}) => {
    let release!: () => void;
    const holdSave = new Promise<void>((resolve) => {
        release = resolve;
    });
    const writes = await editor(page, { holdSave });
    const title = page.getByLabel("Titre d’accueil", { exact: true });
    await title.fill("Brouillon fictif enregistré");
    await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
    try {
        await expect.poll(() => writes.length).toBe(1);
        await expect(title).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "Recharger la configuration", exact: true }),
        ).toBeDisabled();
    } finally {
        release();
    }
    await expect(
        page.getByText("Brouillon enregistré. Les visiteurs ne le voient pas.", { exact: true }),
    ).toBeVisible();
    await expect(title).toBeEnabled();
    await expect(title).toHaveValue("Brouillon fictif enregistré");
    expect(writes).toEqual(["/api/content/draft"]);
});

test("A successful write with failed readback cannot display a fully verified success", async ({
    page,
}) => {
    const writes = await editor(page, { failReadback: true });
    await page.getByLabel("Titre d’accueil", { exact: true }).fill("Copie conservée");
    await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
    await expect(
        page
            .getByRole("status")
            .filter({ hasText: "Enregistrement effectué, mais relecture impossible." }),
    ).toBeVisible();
    await expect(
        page.getByText("Brouillon enregistré. Les visiteurs ne le voient pas.", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Titre d’accueil", { exact: true })).toHaveValue(
        "Copie conservée",
    );
    await expect(page.getByRole("button", { name: "Publier", exact: true })).toBeDisabled();
    expect(writes).toEqual(["/api/content/draft"]);
});

test("Unavailable preview catalogue can be retried without losing the private draft", async ({
    page,
}) => {
    const writes = await editor(page);
    await page.route("**/api/products?limit=4", (route) => route.fulfill({ status: 503 }));
    await page.getByLabel("Titre d’accueil", { exact: true }).fill("Brouillon après incident");
    await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
    await expect(
        page.getByRole("alert").filter({ hasText: "Le catalogue de l’aperçu est indisponible." }),
    ).toBeVisible();
    await expect(page.locator(".admin-draft-preview .storefront-home")).toHaveCount(0);
    await page.unroute("**/api/products?limit=4");
    await page
        .locator(".admin-draft-preview")
        .getByRole("button", { name: "Réessayer", exact: true })
        .click();
    await expect(page.locator(".admin-draft-preview .catalog-card")).toContainText("منتج المعاينة");
    await expect(page.getByLabel("Titre d’accueil", { exact: true })).toHaveValue(
        "Brouillon après incident",
    );
    expect(writes).toEqual([]);
});

test("Closing or reloading a dirty content editor warns before losing the draft", async ({
    page,
}) => {
    const writes = await editor(page);
    await page.getByLabel("Titre d’accueil", { exact: true }).fill("Texte non enregistré");
    let protectedReload = false;
    page.once("dialog", async (dialog) => {
        protectedReload = dialog.type() === "beforeunload";
        await dialog.dismiss();
    });
    await page.reload({ timeout: 3000 }).catch(() => {});
    expect(protectedReload).toBe(true);
    await expect(page.getByLabel("Titre d’accueil", { exact: true })).toHaveValue(
        "Texte non enregistré",
    );
    expect(writes).toEqual([]);
});

test("Public home and product cards retain ordinary same-tab navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main .catalog-card").first()).toBeVisible();
    for (const link of await page.locator('main a:not([href^="#"])').all())
        await expect(link).not.toHaveAttribute("target", "_blank");
    await expect(page.locator(".draft-preview-notice")).toHaveCount(0);
});
