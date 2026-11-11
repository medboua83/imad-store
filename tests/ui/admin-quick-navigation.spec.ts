import { expect, test, type Page } from "@playwright/test";

const order = {
    id: "666666666666666666666666", customerName: "Client de recette", customerPhone: "+212600000099",
    city: "Rabat", address: "Adresse fictive", status: "PENDING", paymentStatus: "PENDING",
    paymentMethod: "COD", totalAmount: 280, shippingCost: 30, createdAt: "2026-11-11T10:00:00Z", items: [],
};
async function fixture(page: Page) {
    let settings = { shippingCost: 30, freeShippingMin: 500, directSiteConfirmation: false, metaPixelEnabled: false };
    const writes: unknown[] = [];
    let fail = true;
    await page.addInitScript(() => {
        localStorage.setItem("adminToken", "isolated-quick-navigation");
        if (!localStorage.getItem("imad-admin-language")) localStorage.setItem("imad-admin-language", "fr");
    });
    await page.route("**/api/**", async (route) => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== "GET") {
            writes.push(req.postDataJSON());
            if (path !== "/api/settings") return route.fulfill({ status: 405 });
            if (fail) { fail = false; return route.fulfill({ status: 503 }); }
            settings = { ...settings, ...req.postDataJSON() };
        }
        const data = path === "/api/settings" ? settings : path === "/api/orders" ? [order]
            : path === "/api/integrations/olivraison" ? {
                saved: false, enabled: false, autoPickup: false, pickupAddress: {}, cityMapping: {},
            } : [];
        await route.fulfill({ json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 } });
    });
    return writes;
}
for (const width of [320, 390, 1440]) {
    test(`Recent orders open exact details and respect history at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const writes = await fixture(page);
        await page.goto("/admin?keep=1");
        const open = page.getByRole("button", { name: "Ouvrir la commande #66666666", exact: true });
        await expect(open).toBeVisible();
        await open.focus();
        await page.keyboard.press("Enter");
        const details = page.getByRole("dialog");
        await expect(details).toBeVisible();
        await expect(details.getByRole("heading", { name: "#66666666", exact: true })).toBeVisible();
        await expect(page).toHaveURL(url => url.searchParams.get("order") === order.id && url.searchParams.get("keep") === "1");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath("order-shortcut.png") });
        await page.reload();
        await expect(details).toBeVisible();
        await expect(details.getByRole("heading", { name: "#66666666", exact: true })).toBeVisible();
        await details.getByRole("button", { name: "Fermer les détails", exact: true }).click();
        await expect(details).not.toBeVisible();
        await expect(page).toHaveURL(url => !url.searchParams.has("order"));
        await page.getByRole("button", { name: /Voir les détails.*66666666/ }).click();
        await expect(details).toBeVisible();
        await page.goBack();
        await expect(details).not.toBeVisible();
        await page.goForward();
        await expect(details).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(details).not.toBeVisible();
        await page.getByLabel("Langue de l’administration").selectOption("ar");
        await page.goto("/admin");
        await expect(page.getByRole("button", { name: "فتح الطلب #66666666", exact: true })).toBeVisible();
        expect(writes).toEqual([]);
    });

    test(`Settings shortcuts keep drafts and confirmation retry is safe at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const writes = await fixture(page);
        await page.goto("/admin?tab=commerce");
        const nav = page.getByRole("navigation", { name: "Accès rapide aux réglages" });
        const confirmation = page.locator("#order-settings");
        const toggle = confirmation.getByRole("switch");
        const save = confirmation.getByRole("button", { name: "Enregistrer", exact: true });
        await expect(toggle).not.toBeChecked();
        await expect(save).toBeDisabled();
        async function jump(id: string, label: string) {
            if (width < 768) await page.getByLabel("Aller à un réglage", { exact: true }).selectOption(id);
            else await nav.getByRole("link", { name: label, exact: true }).click();
            await expect(page.locator(`#${id}`)).toBeFocused();
            await expect(page).toHaveURL(url => url.hash === `#${id}`);
        }
        await jump("order-settings", "Gestion des commandes");
        await toggle.check();
        await expect(confirmation.getByText("Modifications non enregistrées", { exact: true })).toBeVisible();
        await jump("pixel-settings", "Meta Pixel");
        await jump("return-settings", "Délais et retours");
        await jump("shipping-settings", "Règles de livraison");
        await jump("social-settings", "Réseaux sociaux et WhatsApp");
        await jump("order-settings", "Gestion des commandes");
        await expect(toggle).toBeChecked();
        let warned = false;
        page.once("dialog", async d => { warned = d.type() === "beforeunload"; await d.dismiss(); });
        await page.reload({ timeout: 2000 }).catch(() => {});
        expect(warned).toBe(true);
        await save.click();
        await expect(confirmation.getByRole("alert")).toContainText("Enregistrement non confirmé");
        await expect(toggle).toBeChecked();
        await expect(save).toBeEnabled();
        await save.click();
        await expect(confirmation.getByRole("status")).toHaveText("Gestion des commandes enregistrée.");
        await expect(save).toBeDisabled();
        expect(writes).toEqual([{ directSiteConfirmation: true }, { directSiteConfirmation: true }]);
        await page.reload();
        await expect(toggle).toBeChecked();
        await expect(page.locator("#order-settings")).toBeFocused();
        await page.getByLabel("Langue de l’administration").selectOption("ar");
        await page.goto("/admin?tab=commerce#social-settings");
        await expect(page.locator("#social-settings")).toBeFocused();
        await expect(page.getByRole("heading", { name: "وسائل التواصل الاجتماعي وواتساب" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath("settings-ar.png") });
        if (width < 768) await page.getByRole("button", { name: "القائمة", exact: true }).click();
        await page.locator("#admin-navigation").getByRole("button", { name: "الطلبات", exact: true }).click();
        await expect(page).toHaveURL(url => url.hash === "" && url.searchParams.get("tab") === "orders");
    });
}

test("Order deep links never expose an unrelated order", async ({ page }) => {
    const writes = await fixture(page);
    await page.goto("/admin?tab=orders&order=999999999999999999999999");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Commande indisponible", exact: true })).toBeVisible();
    await page.goto("/admin?tab=orders&order=not-an-order");
    await expect(page.getByRole("heading", { name: "Suivi des commandes", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(writes).toEqual([]);
});
