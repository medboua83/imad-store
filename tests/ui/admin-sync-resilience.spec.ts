import { test, expect, type Page } from "@playwright/test";

async function partialAdmin(page: Page, repeatedFailure = false) {
    let reads = 0,
        release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const writes: string[] = [];
    const category = {
        id: "111111111111111111111111",
        slug: "mens-clogs",
        nameFr: "Sabots",
        nameAr: "صابو",
        nameEn: "Clogs",
    };
    const product = {
        id: "222222222222222222222222",
        slug: "sync-fixture",
        nameFr: "Article fictif",
        nameAr: "منتج تجريبي",
        nameEn: "Fixture item",
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
                sku: "SYNC-TEST",
                color: "#000000",
                colorNameFr: "Noir",
                colorNameAr: "أسود",
                colorNameEn: "Black",
                size: "40",
                stock: 5,
            },
        ],
    };
    const order = {
        id: "777777777777777777777771",
        customerName: "Client fictif",
        customerPhone: "+212600000099",
        city: "Rabat",
        address: "Adresse fictive",
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: "COD",
        totalAmount: 230,
        shippingCost: 0,
        createdAt: "2026-11-06T10:00:00Z",
        items: [],
    };
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-partial-sync"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            path = new URL(request.url()).pathname;
        if (path === "/api/auth/login" && request.method() === "POST")
            return route.fulfill({
                json: {
                    success: true,
                    data: {
                        accessToken: "new-isolated-sync-session",
                        refreshToken: "isolated-refresh",
                    },
                },
            });
        if (request.method() !== "GET") {
            writes.push(path);
            return route.fulfill({ status: 405 });
        }
        if (path === "/api/notifications") {
            reads++;
            if (reads > 1) await gate;
            if (reads === 1 || repeatedFailure) return route.fulfill({ status: 503 });
        }
        const data =
            path === "/api/products/admin/catalog"
                ? [product]
                : path === "/api/categories"
                  ? [category]
                  : path === "/api/orders"
                    ? [order]
                    : path === "/api/settings"
                      ? {
                            shippingCost: 30,
                            freeShippingMin: 500,
                            codEnabled: true,
                            metaPixelEnabled: false,
                        }
                      : path === "/api/integrations/olivraison"
                        ? {
                              saved: false,
                              enabled: false,
                              autoPickup: false,
                              configured: false,
                              cityMapping: {},
                              pickupAddress: {},
                          }
                        : [];
        await route.fulfill({
            json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 },
        });
    });
    return { release, writes, reads: () => reads };
}

async function section(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) === "false")
        await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}
async function loadedWithError(page: Page) {
    await expect(
        page
            .locator(".admin-alert")
            .filter({ hasText: "Certaines données n’ont pas pu être actualisées." }),
    ).toBeVisible();
}

for (const width of [390, 1440]) {
    test(`Automatic retry after an initial partial failure keeps the product draft at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await partialAdmin(page);
        await page.goto("/admin?tab=products");
        await loadedWithError(page);
        await page.getByRole("button", { name: "Modifier Article fictif", exact: true }).click();
        await page.clock.runFor(50);
        const name = page.getByLabel("Nom français", { exact: true });
        await name.fill("Brouillon conservé après incident");
        await page.clock.fastForward(30_000);
        try {
            await expect.poll(mock.reads).toBe(2);
            await expect(name).toBeVisible();
            await expect(name).toHaveValue("Brouillon conservé après incident");
        } finally {
            mock.release();
        }
        await expect(page.locator(".admin-sync")).toContainText("À jour à");
        await expect(name).toHaveValue("Brouillon conservé après incident");
        expect(mock.writes).toEqual([]);
    });

    test(`Repeated partial failures keep visible settings and hidden category drafts at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await partialAdmin(page, true);
        await page.goto("/admin?tab=categories");
        await loadedWithError(page);
        const categoryName = page.getByLabel("Nom français", { exact: true });
        await categoryName.fill("Catégorie non enregistrée");
        await section(page, "Paramètres");
        const shipping = page.getByLabel("Frais de livraison (DH)", { exact: true });
        await expect(shipping).toHaveValue("30");
        await shipping.fill("37");
        await page.getByRole("button", { name: "Actualiser les données", exact: true }).click();
        try {
            await expect.poll(mock.reads).toBe(2);
            await expect(shipping).toBeVisible();
            await expect(shipping).toHaveValue("37");
        } finally {
            mock.release();
        }
        await expect(page.locator(".admin-sync")).toContainText("Actualisation incomplète");
        await section(page, "Catégories");
        await expect(categoryName).toHaveValue("Catégorie non enregistrée");
        expect(mock.writes).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });

    test(`Background recovery does not close the order being inspected at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const mock = await partialAdmin(page);
        await page.goto("/admin?tab=orders");
        await loadedWithError(page);
        await page.getByRole("button", { name: /Voir les détails/ }).click();
        await expect(page.locator(".order-detail-dialog")).toBeVisible();
        await page.clock.fastForward(30_000);
        try {
            await expect.poll(mock.reads).toBe(2);
            await expect(page.locator(".order-detail-dialog")).toBeVisible();
            await expect(page.locator(".order-detail-dialog")).toContainText("Client fictif");
        } finally {
            mock.release();
        }
        await expect(page.locator(".admin-sync")).toContainText("À jour à");
        await expect(page.locator(".order-detail-dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator(".order-detail-dialog")).not.toBeVisible();
            await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
        expect(mock.writes).toEqual([]);
    });
}

test("A new session waits for its own initial data instead of reusing the completed load", async ({
    page,
}) => {
    const mock = await partialAdmin(page);
    await page.goto("/admin?tab=products");
    await loadedWithError(page);
    await expect(
        page.getByRole("button", { name: "Modifier Article fictif", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("imad:session-expired")));
    await page.getByLabel("Adresse e-mail", { exact: true }).fill("fixture@example.invalid");
    await page.getByLabel("Mot de passe", { exact: true }).fill("isolated-local-fixture");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    try {
        await expect.poll(mock.reads).toBe(2);
        await expect(
            page.getByRole("status").filter({ hasText: "Chargement des données…" }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Modifier Article fictif", exact: true }),
        ).toHaveCount(0);
    } finally {
        mock.release();
    }
    await expect(
        page.getByRole("button", { name: "Modifier Article fictif", exact: true }),
    ).toBeVisible();
    expect(mock.writes).toEqual([]);
});
