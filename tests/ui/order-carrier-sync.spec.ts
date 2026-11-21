import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) for (const locale of ["fr", "ar"] as const) {
    test(`Order carrier status, failed refresh and retry at ${width}px in ${locale}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(locale => {
            localStorage.setItem("adminToken", "isolated-carrier-fixture");
            localStorage.setItem("imad-admin-language", locale);
        }, locale);
        const id = "777777777777777777771234";
        const order = {
            id, customerName: "Client fictif", city: "Rabat", status: "SHIPPED",
            paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 230,
            shippingCost: 30, createdAt: "2026-11-21T10:00:00Z", items: [],
            shipment: { id, trackingId: "OL-FICTIF", carrierStatus: "TRANSIT", state: "ACTIVE", lastError: null, lastSyncedAt: "2026-11-21T12:00:00Z" },
        };
        let syncs = 0;
        const mutations: string[] = [];
        await page.route("**/api/**", async route => {
            const path = new URL(route.request().url()).pathname;
            if (route.request().method() !== "GET") {
                mutations.push(path);
                if (path !== `/api/orders/${id}/olivraison-sync`) return route.fulfill({ status: 405 });
                if (++syncs === 1) return route.fulfill({ status: 503, json: { error: "Connexion temporairement indisponible" } });
                order.status = "DELIVERED";
                Object.assign(order.shipment, { carrierStatus: "DELIVERED", state: "DONE", lastSyncedAt: "2026-11-21T12:05:00Z" });
                return route.fulfill({ json: { success: true, data: { synced: true } } });
            }
            const data = path === "/api/orders" ? [order] : [];
            await route.fulfill({ json: { success: true, data, total: data.length, page: 1, totalPages: 1, unread: 0 } });
        });
        await page.goto("/admin?tab=orders");
        const label = locale === "fr" ? "Suivi Olivraison" : "تتبع Olivraison";
        const transit = locale === "fr" ? "En livraison" : "قيد التوصيل";
        await expect(page.getByRole("region", { name: label })).toContainText(transit);
        await expect(page.getByRole("region", { name: label })).toContainText("OL-FICTIF");
        await page.getByRole("button", { name: locale === "fr" ? /Voir les détails/ : /عرض التفاصيل/ }).click();
        const dialog = page.getByRole("dialog");
        const tracking = dialog.getByRole("region", { name: label });
        const check = tracking.getByRole("button", { name: locale === "fr" ? "Vérifier chez Olivraison" : "التحقق لدى Olivraison" });
        await check.click();
        await expect(dialog.getByRole("alert")).toContainText("Connexion temporairement indisponible");
        await expect(tracking).toContainText(transit);
        await check.click();
        await expect(tracking).toContainText(locale === "fr" ? "Livré" : "تم التوصيل");
        await expect(tracking.locator("time")).toHaveAttribute("datetime", "2026-11-21T12:05:00Z");
        await expect(dialog.getByText(locale === "fr" ? "En attente de paiement" : "في انتظار الدفع", { exact: true })).toBeVisible();
        expect(mutations).toEqual([`/api/orders/${id}/olivraison-sync`, `/api/orders/${id}/olivraison-sync`]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: info.outputPath(`suivi-olivraison-${locale}-${width}.png`), fullPage: true });
    });
}
