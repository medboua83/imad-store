import { test, expect, type Page } from "@playwright/test";

async function mockAdmin(page: Page, reads: string[] = []) {
    const writes: string[] = [];
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-draft-fixture"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            path = new URL(request.url()).pathname;
        if (request.method() !== "GET") {
            writes.push(path);
            return route.fulfill({ status: 405 });
        }
        reads.push(path);
        const data =
            path === "/api/settings"
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
                  : path === "/api/integrations/deskcomm"
                    ? { enabled: false, configured: false, updatedAt: null }
                    : [];
        await route.fulfill({ json: { success: true, data, total: 0, unread: 0 } });
    });
    return writes;
}
async function section(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) === "false")
        await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}

for (const width of [390, 1440]) {
    test(`Settings and category drafts survive section changes and history without writes at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.clock.install();
        const reads: string[] = [];
        const writes = await mockAdmin(page, reads);
        await page.goto("/admin?tab=commerce");
        const shipping = page.getByLabel("Frais de livraison (DH)", { exact: true });
        await expect(shipping).toHaveValue("30");
        await shipping.fill("37");
        await section(page, "Intégration CRM");
        await page.getByText("Avancé — adresse et clés de connexion", { exact: true }).click();
        const webhook = page.getByLabel("URL du webhook (vide = conserver l'existante)", { exact: true });
        await webhook.fill("https://crm.example.test/draft-not-saved");
        await section(page, "Catégories");
        await page.getByLabel("Nom français", { exact: true }).fill("Catégorie en préparation");
        await section(page, "Vue d’ensemble");
        const shipmentReads = reads.filter(path => path === "/api/integrations/olivraison/shipments").length;
        await page.clock.fastForward(31_000);
        expect(reads.filter(path => path === "/api/integrations/olivraison/shipments")).toHaveLength(shipmentReads);
        await page.goBack();
        await expect(page.getByLabel("Nom français", { exact: true })).toHaveValue(
            "Catégorie en préparation",
        );
        await section(page, "Intégration CRM");
        await expect(webhook).toHaveValue("https://crm.example.test/draft-not-saved");
        await section(page, "Paramètres");
        await expect(shipping).toHaveValue("37");
        await page
            .getByRole("combobox", { name: "Langue de l’administration / لغة لوحة الإدارة" })
            .selectOption("ar");
        await expect(page.getByLabel("رسوم التوصيل (درهم)", { exact: true })).toHaveValue("37");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`settings-draft-${width}.png`) });
        expect(writes).toEqual([]);
    });

    test(`Enter in city search only moves to city selection and never submits checkout at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript(() =>
            localStorage.setItem(
                "imad-store-cart",
                JSON.stringify({
                    state: {
                        items: [
                            {
                                productId: "222222222222222222222222",
                                productSlug: "fixture-sabot",
                                variantId: "333333333333333333333330",
                                nameFr: "Sabot fictif",
                                nameAr: "صابو تجريبي",
                                nameEn: "Fixture clog",
                                colorNameFr: "أسود",
                                colorNameAr: "أسود",
                                colorNameEn: "أسود",
                                size: "40",
                                price: 230,
                                quantity: 1,
                                stock: 2,
                                image: "/images/catalogue-test/sac.webp",
                                freeShipping: true,
                            },
                        ],
                    },
                    version: 0,
                }),
            ),
        );
        let orders = 0;
        await page.route("**/api/orders", (route) => {
            orders++;
            return route.abort("failed");
        });
        await page.goto("/checkout?stats_test=1");
        await page
            .getByRole("textbox", { name: "الاسم الكامل", exact: true })
            .fill("Client fictif");
        await page.getByRole("textbox", { name: "رقم الهاتف", exact: true }).fill("0600000099");
        await page
            .getByRole("textbox", { name: "عنوان التوصيل", exact: true })
            .fill("Adresse fictive de test 1");
        const city = page.locator("#checkout-city"),
            search = page.locator("#checkout-city-search");
        await city.selectOption("tangier");
        await expect(page.getByRole("button", { name: "تأكيد الطلب", exact: true })).toBeEnabled();
        await search.fill("Rabat");
        await search.press("Enter");
        await expect(city).toBeFocused();
        await expect(city).toHaveValue("tangier");
        await expect(page.locator(".checkout-submission-error")).toHaveCount(0);
        expect(orders).toBe(0);
        await city.selectOption("rabat");
        await search.fill("ville introuvable");
        await search.press("Enter");
        await expect(search).toBeFocused();
        expect(orders).toBe(0);
        await search.fill("");
        await search.press("Enter");
        await expect(city).toBeFocused();
        await page.getByRole("button", { name: "تأكيد الطلب", exact: true }).click();
        await expect.poll(() => orders).toBe(1);
    });
}

for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
]) {
    test(`Catalogue return and purchase controls fit a short desktop at ${viewport.width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize(viewport);
        await page.goto(
            "/products/fixture-manual?returnTo=%2Fshop%3Fcategory%3Dmens-clogs%23catalog-results",
        );
        const buy = page.getByRole("button", { name: "إضافة إلى السلة", exact: true });
        await expect(buy).toBeEnabled();
        const box = await buy.boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        for (const selector of [
            ".product-variant-grid",
            ".quantity-choice-grid",
        ]) {
            const rect = await page.locator(selector).boundingBox();
            expect(rect!.y).toBeGreaterThan(0);
            expect(rect!.y + rect!.height).toBeLessThan(box!.y);
        }
        const quantity = await page.locator(".product-quantity-row").boundingBox();
        expect(quantity!.y + quantity!.height).toBeLessThanOrEqual(viewport.height);
        expect(quantity!.x >= box!.x + box!.width || quantity!.x + quantity!.width <= box!.x).toBe(true);
        await page.getByRole("button", { name: "بني", exact: true }).click();
        await page.getByRole("button", { name: "اختيار 3 قطع", exact: true }).click();
        await expect(page.locator(".purchase-price")).toContainText("630.00");
        const after = await buy.boundingBox();
        expect(after!.y + after!.height).toBeLessThanOrEqual(viewport.height);
        await page.getByRole("spinbutton", { name: "الكمية", exact: true }).fill("");
        await expect(page.locator("#product-quantity-error")).toBeVisible();
        await expect(buy).toBeDisabled();
        await page.getByRole("spinbutton", { name: "الكمية", exact: true }).fill("3");
        await expect(buy).toBeEnabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({
            path: info.outputPath(`product-compact-return-${viewport.width}.png`),
        });
    });
}
