import { test, expect, type Page } from "@playwright/test";
const oldId = "a123456789012345deadbeef";
const oldDate = "2020-01-01T10:00:00Z";
const initialRows = Array.from({ length: 125 }, (_, i) => ({
    id: i === 0 ? oldId : "b" + i.toString(16).padStart(23, "0"),
    customerName: i === 0 ? "Ancienne cliente fictive" : "Client fictif " + i,
    customerPhone: i === 0 ? "+212600000099" : "+212700000000", city: i === 0 ? "Tanger" : "Rabat",
    status: "SHIPPED", paymentStatus: "PENDING", paymentMethod: "COD", totalAmount: 230, shippingCost: 30,
    createdAt: i === 0 ? oldDate : "2026-11-21T10:00:00Z", items: [],
    shipment: { id: i === 0 ? oldId : "b" + i.toString(16).padStart(23, "0"), trackingId: "FICTIF-" + i,
        state: "ACTIVE", carrierStatus: "TRANSIT", lastSyncedAt: "2026-11-21T12:00:00Z", lastError: null },
}));
async function fixture(page: Page, locale = "fr", small = false) {
    const rows = structuredClone(initialRows).slice(0, small ? 60 : 125);
    const writes: string[] = [], queries: URL[] = [];
    const control = { fail: false, lag: false, release: () => {} };
    let resolve!: () => void;
    const gate = new Promise<void>(r => { resolve = r; }); control.release = resolve;
    await page.addInitScript(locale => {
        localStorage.setItem("adminToken", "isolated-full-history");
        localStorage.setItem("imad-admin-language", locale);
    }, locale);
    await page.route("**/api/**", async route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() !== "GET") { writes.push(url.pathname); return route.fulfill({ status: 405 }); }
        if (url.pathname === `/api/orders/${oldId}/admin-details`)
            return route.fulfill({ json: { success: true, data: rows[0] } });
        if (url.pathname !== "/api/orders") return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
        queries.push(url);
        const limit = Number(url.searchParams.get("limit") || 20), search = url.searchParams.get("search") || "";
        if (limit === 25 && control.fail) return route.fulfill({ status: 503 });
        if (limit === 25 && search === "lag" && control.lag) await gate;
        const scope = rows.filter(r => !search || [r.id, r.customerName, r.customerPhone, r.city].some(v => v.toLowerCase().includes(search.toLowerCase().replace(/^#/, ""))));
        const counts: Record<string, number> = { PENDING: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
        for (const row of scope) counts[row.status]++;
        const filtered = scope.filter(r => !url.searchParams.get("status") || r.status === url.searchParams.get("status"));
        filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
        const totalPages = Math.ceil(filtered.length / limit), current = Math.min(Number(url.searchParams.get("page") || 1), Math.max(1, totalPages));
        try { await route.fulfill({ json: { success: true, data: filtered.slice((current - 1) * limit, current * limit),
            total: filtered.length, scopeTotal: scope.length, statusCounts: counts, page: current, totalPages } }); } catch { /* Superseded read may have been aborted. */ }
    });
    return { rows, writes, queries, control };
}
for (const width of [390, 1440]) {
    test(`Historical pages find an order beyond 100, preserve details and poll its status at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page);
        await page.goto("/admin?tab=orders");
        const pagination = page.getByRole("navigation", { name: "Navigation des commandes, début", exact: true });
        await expect(pagination).toContainText("Page 1 sur 5");
        await expect(page.locator(".admin-order-card")).toHaveCount(25);
        await pagination.getByRole("button", { name: "Page suivante", exact: true }).click();
        await expect(pagination).toContainText("Page 2 sur 5");
        const search = page.getByLabel("Rechercher une commande");
        await search.fill("#DEADBEEF");
        await expect(page.locator(".admin-order-card")).toHaveCount(1);
        await expect(page.getByRole("heading", { name: "Ancienne cliente fictive", exact: true })).toBeVisible();
        await expect(pagination).toHaveCount(0);
        await page.locator(".order-quick-filters").getByRole("button", { name: /^Expédiée/ }).click();
        await expect(page.locator(".admin-order-card")).toHaveCount(1);
        await page.getByRole("button", { name: /Voir les détails/ }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("FICTIF-0");
        f.rows[0].status = "DELIVERED"; f.rows[0].shipment.carrierStatus = "DELIVERED";
        await expect(dialog.getByRole("region", { name: "Suivi Olivraison" })).toContainText("Livré", { timeout: 12000 });
        await expect(dialog.getByText("En attente de paiement", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Fermer les détails" }).click();
        await expect(search).toHaveValue("#DEADBEEF");
        await expect(page.locator(".admin-order-card")).toHaveCount(0);
        await page.locator(".order-quick-filters").getByRole("button", { name: /^Toutes/ }).click();
        await search.fill("600000099");
        await expect(page.locator(".admin-order-card")).toHaveCount(1);
        expect(f.queries.some(q => q.searchParams.get("search") === "#DEADBEEF" && q.searchParams.get("page") === "1")).toBe(true);
        expect(f.writes).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath("history.png"), fullPage: true });
    });
    test(`Failed and superseded history searches cannot show another query's orders at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page);
        await page.goto("/admin?tab=orders");
        await expect(page.locator(".admin-order-card")).toHaveCount(25);
        const search = page.getByLabel("Rechercher une commande");
        f.control.lag = true;
        await search.fill("lag");
        await expect.poll(() => f.queries.some(q => q.searchParams.get("search") === "lag")).toBe(true);
        await search.fill("deadbeef");
        await expect(page.locator(".admin-order-card")).toHaveCount(1);
        f.control.release();
        await expect(page.getByRole("heading", { name: "Ancienne cliente fictive", exact: true })).toBeVisible();
        f.control.fail = true;
        await search.fill("inconnu");
        await expect(page.getByRole("alert").filter({ hasText: "Recherche dans l’historique impossible" })).toBeVisible();
        await expect(page.locator(".admin-order-card")).toHaveCount(0);
        f.control.fail = false;
        await page.getByRole("button", { name: "Réessayer", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Aucune commande trouvée" })).toBeVisible();
        expect(f.writes).toEqual([]);
    });
}
test("An old direct link loads authenticated details with Arabic layout on a narrow screen", async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const f = await fixture(page, "ar");
    await page.goto(`/admin?tab=orders&order=${oldId}`);
    await expect(page.getByRole("dialog")).toContainText("FICTIF-0");
    await expect(page.getByRole("dialog")).toContainText("في انتظار الدفع");
    expect(await page.getByRole("dialog").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("old-order-ar.png"), fullPage: true });
    expect(f.writes).toEqual([]);
});
test("Complete smaller collections also have 25-row pages and keep reference search correct", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const f = await fixture(page, "fr", true);
    await page.goto("/admin?tab=orders");
    await expect(page.getByRole("navigation", { name: "Navigation des commandes, début" })).toContainText("Page 1 sur 3");
    await page.getByLabel("Rechercher une commande").fill("#deadbeef");
    await expect(page.locator(".admin-order-card")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Ancienne cliente fictive", exact: true })).toBeVisible();
    expect(f.writes).toEqual([]);
});
