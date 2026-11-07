import { test, expect, type Page } from "@playwright/test";

async function settingsFixture(page: Page, failSave = false) {
    let settings = {
        shippingCost: 30,
        freeShippingMin: 500,
        codEnabled: true,
        metaPixelEnabled: false,
    };
    const writes: string[] = [];
    await page.addInitScript(() => {
        localStorage.setItem("adminToken", "isolated-settings-draft");
        localStorage.setItem("imad-admin-language", "fr");
    });
    await page.route("**/api/**", async (route) => {
        const req = route.request(),
            path = new URL(req.url()).pathname;
        if (req.method() !== "GET") {
            writes.push(req.method() + " " + path);
            if (path === "/api/settings" && req.method() === "PUT") {
                if (failSave)
                    return route.fulfill({ status: 500, json: { error: "Isolated save failure" } });
                settings = { ...settings, ...req.postDataJSON() };
                return route.fulfill({ json: { success: true, data: settings } });
            }
            return route.fulfill({ status: 405 });
        }
        const data =
            path === "/api/settings"
                ? settings
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
        return route.fulfill({ json: { success: true, data, total: 0, unread: 0 } });
    });
    await page.goto("/admin?tab=commerce");
    await expect(page.getByLabel("Frais de livraison (DH)", { exact: true })).toHaveValue("30");
    return writes;
}
async function reloadProtected(page: Page) {
    let protectedReload = false;
    page.once("dialog", async (dialog) => {
        protectedReload = dialog.type() === "beforeunload";
        await dialog.dismiss();
    });
    await page.reload({ timeout: 3000 }).catch(() => {});
    return protectedReload;
}
for (const width of [390, 1440]) {
    test(`Unsaved delivery and Pixel settings survive a cancelled reload at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const writes = await settingsFixture(page);
        const shipping = page.getByLabel("Frais de livraison (DH)", { exact: true });
        await shipping.fill("37");
        expect(await reloadProtected(page)).toBe(true);
        await expect(shipping).toHaveValue("37");
        await expect(
            page.getByText("Modifications non enregistrées", { exact: true }),
        ).toBeVisible();
        expect(writes).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`settings-protected-${width}.png`) });
    });
    test(`Failed settings save keeps its draft and reload warning at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const writes = await settingsFixture(page, true);
        await page.getByLabel("Frais de livraison (DH)", { exact: true }).fill("37");
        await page.getByRole("button", { name: "Enregistrer les réglages", exact: true }).click();
        await expect(page.getByRole("alert")).toContainText("Enregistrement impossible");
        expect(await reloadProtected(page)).toBe(true);
        await expect(page.getByLabel("Frais de livraison (DH)", { exact: true })).toHaveValue("37");
        expect(writes).toEqual(["PUT /api/settings"]);
    });
    test(`Saving settings clears the warning and reloads the saved values at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const writes = await settingsFixture(page);
        await page.getByLabel("Frais de livraison (DH)", { exact: true }).fill("37");
        await page.getByRole("button", { name: "Enregistrer les réglages", exact: true }).click();
        await expect(page.getByText("Réglages enregistrés.", { exact: true })).toBeVisible();
        await expect(page.getByText("Modifications non enregistrées", { exact: true })).toHaveCount(
            0,
        );
        expect(await reloadProtected(page)).toBe(false);
        await expect(page.getByLabel("Frais de livraison (DH)", { exact: true })).toHaveValue("37");
        expect(writes).toEqual(["PUT /api/settings"]);
    });
    test(`Returning settings to their loaded values needs no reload warning at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const writes = await settingsFixture(page);
        const shipping = page.getByLabel("Frais de livraison (DH)", { exact: true });
        await shipping.fill("37");
        await shipping.fill("30");
        expect(await reloadProtected(page)).toBe(false);
        await expect(shipping).toHaveValue("30");
        expect(writes).toEqual([]);
    });
    test(`A late basket snapshot cannot change the newer displayed price at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const item = {
            productId: "222222222222222222222222",
            productSlug: "fixture-sabot",
            variantId: "333333333333333333333330",
            nameFr: "Article fictif",
            nameAr: "منتج تجريبي",
            nameEn: "Fixture item",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            size: "40",
            price: 230,
            quantity: 1,
            stock: 5,
            image: "/images/catalogue-test/sac.webp",
            freeShipping: true,
        };
        await page.addInitScript(
            (value) =>
                localStorage.setItem(
                    "imad-store-cart",
                    JSON.stringify({ state: { items: [value] }, version: 0 }),
                ),
            item,
        );
        let release!: () => void,
            reads = 0,
            oldFinished = false,
            writes = 0;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route("**/api/products/fixture-sabot", async (route) => {
            const old = ++reads === 1;
            const product = {
                id: item.productId,
                slug: item.productSlug,
                nameFr: item.nameFr,
                nameAr: item.nameAr,
                nameEn: item.nameEn,
                price: old ? 230 : 260,
                images: [item.image],
                freeShipping: true,
                quantityDiscounts: [],
                variants: [
                    {
                        id: item.variantId,
                        size: "40",
                        stock: old ? 5 : 4,
                        colorNameFr: item.colorNameFr,
                        colorNameAr: item.colorNameAr,
                        colorNameEn: item.colorNameEn,
                    },
                ],
            };
            if (old) await gate;
            await route.fulfill({ json: { success: true, data: product } });
            if (old) oldFinished = true;
        });
        await page.route("**/api/orders", (route) => {
            writes++;
            return route.abort();
        });
        await page.goto("/checkout?stats_test=1");
        await expect.poll(() => reads).toBe(1);
        await page.getByRole("button", { name: "فتح السلة، 1 قطعة", exact: true }).click();
        const total = page.locator(".cart-dialog .bag-grand-total");
        try {
            await expect(total).toContainText("260.00");
        } finally {
            release();
        }
        await expect.poll(() => oldFinished).toBe(true);
        await page.evaluate(
            () =>
                new Promise<void>((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ),
        );
        await expect(total).toContainText("260.00");
        expect(writes).toBe(0);
        await page.screenshot({ path: info.outputPath(`cart-fresh-${width}.png`) });
    });
}
