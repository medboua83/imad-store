import { test, expect, type Page } from "@playwright/test";
import { defaultSiteContent } from "@imad-store/shared";

async function setup(page: Page, initiallyUnavailable = false) {
    const category = {
        id: "a".repeat(24),
        slug: "mens-clogs",
        nameAr: "ملابس",
        nameFr: "Collection",
        nameEn: "Collection",
        publishedCount: 25,
    };
    const products = Array.from({ length: 25 }, (_, offset) => {
        const number = offset + 1,
            suffix = String(number).padStart(2, "0");
        return {
            id: number.toString(16).padStart(24, "0"),
            slug: `hero-${number}`,
            nameFr: `Article ${suffix}`,
            nameAr: `منتج ${suffix}`,
            nameEn: `Item ${suffix}`,
            descriptionFr: "",
            descriptionAr: "",
            descriptionEn: "",
            price: 100 + number,
            category,
            status: number === 24 ? "DRAFT" : "ACTIVE",
            images: [
                number % 2
                    ? "/images/catalogue-test/abaya.webp"
                    : "/images/catalogue-test/sac.webp",
            ],
            variants: [
                {
                    id: `b${number.toString(16).padStart(23, "0")}`,
                    sku: `HERO-${number}`,
                    color: "#000000",
                    colorNameFr: "Noir",
                    colorNameAr: "أسود",
                    colorNameEn: "Black",
                    size: "M",
                    stock: number === 23 ? 0 : 5,
                },
            ],
        };
    });
    const originalProducts = JSON.stringify(products);
    let draft = {
        ...defaultSiteContent,
        ...(initiallyUnavailable
            ? {
                  heroProductMode: "manual" as const,
                  heroProductIds: [products[23].id, products[24].id],
              }
            : {}),
    };
    let published = { ...defaultSiteContent },
        revision = 1,
        failOnce = !initiallyUnavailable;
    const writes: string[] = [];
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-hero-editor"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            url = new URL(request.url()),
            path = url.pathname;
        if (request.method() !== "GET") {
            writes.push(path);
            if (path === "/api/content/draft") {
                if (failOnce) {
                    failOnce = false;
                    return route.fulfill({ status: 503, json: { error: "Échec fictif" } });
                }
                draft = request.postDataJSON().content;
                revision++;
            } else if (path === "/api/content/publish") {
                published = { ...draft };
                revision++;
            } else return route.fulfill({ status: 405 });
            return route.fulfill({ json: { success: true } });
        }
        let data: unknown = [],
            total = 0,
            totalPages = 0;
        if (path === "/api/content/admin")
            data = { draft, published, revision, canRollback: false };
        if (path === "/api/products") {
            data = products.slice(0, 8);
            total = 8;
            totalPages = 1;
        }
        if (path === "/api/products/admin/catalog") {
            const ids = url.searchParams.get("ids")?.split(","),
                search = url.searchParams.get("search")?.toLowerCase() || "";
            const filtered = products.filter((p) =>
                ids
                    ? ids.includes(p.id)
                    : p.status === "ACTIVE" && p.nameFr.toLowerCase().includes(search),
            );
            total = filtered.length;
            const limit = Number(url.searchParams.get("limit") || 20),
                page = Number(url.searchParams.get("page") || 1);
            totalPages = Math.ceil(total / limit);
            data = filtered.slice((page - 1) * limit, page * limit);
        }
        if (path === "/api/categories") data = [category];
        return route.fulfill({ json: { success: true, data, total, totalPages, unread: 0 } });
    });
    await page.goto("/admin?tab=content");
    await expect(page.getByLabel("Titre d’accueil", { exact: true })).toHaveValue(
        defaultSiteContent.heroTitle,
    );
    return {
        products,
        writes,
        published: () => published,
        assertProductsUnchanged: () => expect(JSON.stringify(products)).toBe(originalProducts),
    };
}

for (const width of [320, 390, 1440]) {
    test(`Owner selects, orders, previews and publishes hero products without losing retries at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: width > 767 ? 1000 : 844 });
        const state = await setup(page);
        const editor = page.locator("#hero-products");
        const mode = editor.getByRole("radio", { name: "Choisir les produits", exact: true });
        const modeBox = (await mode.boundingBox())!;
        expect(modeBox.width).toBeLessThanOrEqual(24);
        expect(modeBox.height).toBeLessThanOrEqual(24);
        await editor.getByRole("radio", { name: "Choisir les produits", exact: true }).check();
        await editor.getByRole("button", { name: "Suivant", exact: true }).click();
        await editor.getByRole("checkbox", { name: "Article 25", exact: true }).check();
        const search = editor.getByLabel("Rechercher un produit pour le bandeau", { exact: true });
        await search.fill("Article 0");
        await editor.getByRole("checkbox", { name: "Article 02", exact: true }).check();
        await editor.getByRole("checkbox", { name: "Article 01", exact: true }).check();
        await editor.getByRole("button", { name: "Monter · Article 01", exact: true }).click();
        const names = editor.locator(".hero-selected-name strong");
        await expect(names).toHaveText(["Article 25", "Article 01", "Article 02"]);
        await editor.getByRole("radio", { name: "Sélection automatique", exact: true }).check();
        await editor.getByRole("radio", { name: "Choisir les produits", exact: true }).check();
        await expect(names).toHaveText(["Article 25", "Article 01", "Article 02"]);
        await editor.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
        await page.screenshot({ path: info.outputPath(`hero-editor-${width}.png`) });
        for (const suffix of ["03", "04", "05"])
            await editor.getByRole("checkbox", { name: `Article ${suffix}`, exact: true }).check();
        await expect(
            editor.getByRole("checkbox", { name: "Article 06", exact: true }),
        ).toBeDisabled();
        await editor
            .getByRole("checkbox", { name: "Défilement automatique", exact: true })
            .uncheck();
        await expect(
            editor.getByRole("checkbox", { name: "Commandes discrètes", exact: true }),
        ).toBeChecked();
        await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
        await expect(page.getByText("Échec fictif", { exact: true })).toBeVisible();
        await expect(names).toHaveCount(6);
        await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
        await expect(
            page.getByText("Brouillon enregistré. Les visiteurs ne le voient pas.", {
                exact: true,
            }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
        const hero = page.getByRole("region", { name: "مختارات IMAD Mode", exact: true });
        await expect(hero.locator(".hero-product-link")).toHaveAttribute(
            "href",
            "/products/hero-25",
        );
        await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 6");
        await hero.getByRole("button", { name: "عرض المنتج 2 من 6", exact: true }).click();
        await expect(hero.locator(".hero-product-link")).toHaveAttribute(
            "href",
            "/products/hero-1",
        );
        await expect(hero.locator(".hero-photo")).toHaveAttribute("src", /abaya.webp/);
        await expect(hero.getByRole("button", { name: /العرض التلقائي/ })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.getByRole("button", { name: "Publier", exact: true }).click();
        await expect(
            page.getByText("Version publiée pour tous les visiteurs.", { exact: true }),
        ).toBeVisible();
        const published = state.published() as typeof defaultSiteContent & {
            heroProductIds: string[];
            heroProductMode: string;
            heroAutoplay: boolean;
            heroMinimalControls: boolean;
        };
        expect(published.heroProductIds).toEqual(
            [25, 1, 2, 3, 4, 5].map((n) => n.toString(16).padStart(24, "0")),
        );
        expect(published.heroProductMode).toBe("manual");
        expect(published.heroAutoplay).toBe(false);
        expect(state.writes).toEqual([
            "/api/content/draft",
            "/api/content/draft",
            "/api/content/publish",
        ]);
        state.assertProductsUnchanged();
    });
}

test("Unavailable selected items stay editable but never become unrelated preview products", async ({
    page,
}) => {
    const state = await setup(page, true),
        editor = page.locator("#hero-products");
    await expect(
        editor.getByText(
            "Indisponible : ignoré dans le bandeau public, sans remplacer votre choix.",
            { exact: true },
        ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Aperçu du brouillon", exact: true }).click();
    const hero = page.getByRole("region", { name: "مختارات IMAD Mode", exact: true });
    await expect(hero.locator(".hero-product-link")).toHaveAttribute("href", "/products/hero-25");
    await editor
        .getByRole("button", { name: "Retirer du bandeau · Article 25", exact: true })
        .click();
    await expect(hero.locator(".hero-product-link")).toHaveAttribute("href", "/shop");
    await expect(hero.locator(".hero-product-price")).toHaveCount(0);
    await expect(hero.getByRole("button")).toHaveCount(0);
    expect(state.writes).toEqual([]);
    state.assertProductsUnchanged();
});

test.describe("Touch merchandising", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    test("Discreet controls stay hidden at rest, touch pauses and horizontal swipe changes the product", async ({
        page,
    }) => {
        await page.clock.install();
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.goto("/?stats_test=1");
        const hero = page.getByRole("region", { name: "مختارات IMAD Mode", exact: true });
        await expect(hero).toHaveAttribute("data-rotation-state", "playing");
        await expect(hero.locator(".hero-pause-toggle")).toHaveCSS("opacity", "0");
        const box = (await hero.locator(".hero-visual").boundingBox())!;
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await expect(hero).toHaveAttribute("data-rotation-state", "paused");
        await page.clock.fastForward(16000);
        await expect(hero.locator(".hero-slide-count")).toHaveText("1 / 3");
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: box.x + box.width - 14, y: box.y + box.height / 2 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: box.x + 14, y: box.y + box.height / 2 }],
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await expect(hero.locator(".hero-slide-count")).toHaveText("2 / 3");
        await expect(hero.locator(".hero-product-link")).toHaveAttribute(
            "href",
            "/products/fixture-premium",
        );
        await expect(hero.locator(".hero-pause-toggle")).toHaveCSS("opacity", "0");
        await cdp.detach();
    });
});
