import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page) {
    const writes: string[] = [];
    await page.addInitScript(() => {
        localStorage.setItem("adminToken", "isolated-dashboard-clarity");
        localStorage.setItem("imad-admin-language", "fr");
    });
    await page.route("**/api/**", async route => {
        const req = route.request();
        if (req.method() !== "GET") {
            writes.push(req.url());
            return route.fulfill({ status: 405 });
        }
        const orders = ["PENDING", "CANCELLED"].map((status, n) => ({
            id: String(n + 1).repeat(24), customerName: `Client fictif ${n + 1}`,
            customerPhone: "+212600000099", city: "Rabat", address: "TEST",
            status, paymentStatus: "PENDING", paymentMethod: "COD",
            totalAmount: 230, shippingCost: 30, createdAt: new Date().toISOString(), items: [],
        }));
        const data = new URL(req.url()).pathname === "/api/orders" ? orders : [];
        return route.fulfill({ json: { success: true, data, total: data.length, unread: 0 } });
    });
    return writes;
}

for (const width of [320, 390, 1440]) {
    test(`Dashboard search precedes maintenance and cancelled orders stay protected at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        const writes = await fixture(page);
        await page.goto("/admin?tab=orders");
        const search = page.getByRole("searchbox", { name: "Rechercher une commande" });
        await expect(search).toBeVisible();
        if (width < 768) {
            expect((await page.locator(".admin-sidebar").boundingBox())!.height).toBeLessThan(85);
            expect((await search.boundingBox())!.y).toBeLessThan(620);
        }
        const maintenance = page.locator(".order-maintenance");
        await expect(maintenance).not.toHaveAttribute("open", "");
        await expect(page.getByRole("button", { name: /^Supprimer les annulées affichées/ })).toBeHidden();
        await search.fill("11111111");
        await expect(page.locator(".admin-order-card")).toHaveCount(1);
        await maintenance.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(maintenance).toHaveAttribute("open", "");
        await expect(page.getByRole("button", { name: /^Supprimer les annulées affichées/ })).toBeDisabled();
        await search.clear();
        await expect(page.locator(".admin-order-card")).toHaveCount(2);
        await expect(page.getByRole("button", { name: /^Supprimer les annulées affichées/ })).toBeEnabled();
        await maintenance.locator("summary").click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("orders.png") });
        await page.getByRole("combobox", { name: "Langue de l’administration / لغة لوحة الإدارة" }).selectOption("ar");
        await expect(maintenance.locator("summary")).toHaveText("إدارة الطلبيات الملغاة");
        await expect(page.locator(".admin-app")).toHaveAttribute("dir", "rtl");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(writes).toEqual([]);
    });
}

test("Overview chart has no invented activity on zero-order days", async ({ page }, testInfo) => {
    const writes = await fixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    const chart = page.locator(".admin-activity-chart");
    await expect(chart.locator(".admin-bar-count")).toHaveCount(7);
    for (const day of await chart.locator(":scope > div").all()) {
        const count = Number(await day.locator(".admin-bar-count").innerText());
        const height = await day.locator(".admin-bar-track > span").evaluate(el => el.getBoundingClientRect().height);
        if (count === 0) expect(height).toBe(0);
        else expect(height).toBeGreaterThan(0);
    }
    await page.screenshot({ path: testInfo.outputPath("overview.png") });
    expect(writes).toEqual([]);
});
