import { test, expect, type Page } from "@playwright/test";
const id = "a123456789012345deadbeef";
async function fixture(page: Page, options: { ar?: boolean; reader?: boolean; fail?: boolean; slow?: boolean } = {}) {
    const state = { fail: options.fail === true, approved: false, searches: [] as string[], writes: [] as string[] };
    await page.addInitScript(options => {
        localStorage.setItem("adminToken", "x." + btoa(JSON.stringify({ role: options.reader ? "STAFF" : "ADMIN", permissions: options.reader ? ["orders.read"] : [] })) + ".x");
        localStorage.setItem("imad-admin-language", options.ar ? "ar" : "fr");
    }, options);
    const row = () => ({ id, status: "CONFIRMED", paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 230,
        shippingCost: 30, customerName: "TEST FICTIF", customerPhone: "+212611111111", city: "Rabat", createdAt: "2020-01-01T10:00:00Z", items: [],
        customerHistory: { available: true, priorCancelledCount: 0 }, customerBlacklist: { available: true, blocked: true, cancelledCount: 3 },
        shipment: { id, state: state.approved ? "QUEUED" : "REVIEW_REQUIRED", trackingId: null, carrierStatus: null, approvedAt: state.approved ? "2026-11-24T10:00:00Z" : null, lastError: null, lastSyncedAt: null } });
    const entries = Array.from({ length: 27 }, (_, n) => ({ phone: n ? "+212655" + String(n).padStart(6, "0") : "+212611111111",
        cancelledCount: 3, trashCount: 1, lastOrderId: id, lastOrderCreatedAt: "2026-11-23T10:00:00Z" }));
    await page.route("**/api/**", async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() !== "GET") {
            state.writes.push(path);
            if (path.endsWith("/olivraison-approve")) { state.approved = true; return route.fulfill({ json: { success: true, data: { approved: true, orderId: id } } }); }
            return route.fulfill({ status: 405 });
        }
        if (path === "/api/auth/me") return route.fulfill({ json: { success: true, data: { id: "111111111111111111111111", email: "test@example.invalid", role: options.reader ? "STAFF" : "ADMIN", permissions: options.reader ? ["orders.read"] : [], firstName: "Test", lastName: "Owner" } } });
        if (path === "/api/orders/dispatch-blacklist") {
            const search = url.searchParams.get("search") || "", pageNumber = Number(url.searchParams.get("page") || 1);
            state.searches.push(search);
            if (state.fail) return route.fulfill({ status: 503, json: { success: false } });
            if (options.slow && search === "1111") await new Promise(r => setTimeout(r, 700));
            const data = search ? [{ ...entries[0], phone: search === "9999" ? "+212699999999" : entries[0].phone }] : entries.slice((pageNumber - 1) * 25, pageNumber * 25);
            return route.fulfill({ json: { success: true, data, page: pageNumber, total: search ? 1 : 27, totalPages: search ? 1 : 2 } }).catch(() => {});
        }
        if (path === "/api/orders") return route.fulfill({ json: { success: true, data: [row()], total: 1, scopeTotal: 1, totalPages: 1, page: 1, statusCounts: { CONFIRMED: 1 }, trackingFilter: "ALL" } });
        if (path.endsWith("/admin-details")) return route.fulfill({ json: { success: true, data: row() } });
        return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
    });
    return state;
}
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

for (const width of [320, 390, 1440]) for (const ar of [false, true]) {
    test(`Blacklist is readable, paginated and searchable without dispatch at ${width}px ${ar ? "Arabic" : "French"}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const state = await fixture(page, { ar }); await page.goto("/admin?tab=orders");
        await expect(page.locator(".admin-order-card")).toContainText(ar ? "الرقم في القائمة السوداء" : "Numéro sur liste noire");
        expect(state.searches).toHaveLength(0);
        const panel = page.locator(".dispatch-blacklist"); await panel.locator("summary").click();
        await expect(panel.locator("li")).toHaveCount(25);
        await expect(panel).toContainText(ar ? "إرسال يدوي" : "Envoi manuel");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await panel.screenshot({ path: info.outputPath("blacklist.png") });
        await panel.getByRole("button", { name: ar ? "الصفحة التالية" : "Page suivante", exact: true }).click();
        await expect(panel.locator("li")).toHaveCount(2);
        await panel.locator("#blacklist-phone").fill("06 11 11 11 11");
        await panel.locator("button[type=submit]").click();
        await expect(panel.locator("li")).toHaveCount(1);
        await expect(panel.locator("li")).toContainText("+212611111111");
        await panel.locator("li button").click();
        await expect(page.locator(".admin-search input")).toHaveValue("+212611111111");
        await expect(panel).not.toHaveAttribute("open", "");
        expect(state.writes).toEqual([]);
    });
}
test("Blacklist failure is explicit and retry does not authorize or replay shipment writes", async ({ page }) => {
    const state = await fixture(page, { fail: true }); await page.goto("/admin?tab=orders");
    const panel = page.locator(".dispatch-blacklist"); await panel.locator("summary").click();
    await expect(panel.getByRole("alert")).toContainText("contrôle serveur des envois reste actif");
    await expect(panel.locator("li")).toHaveCount(0);
    state.fail = false; await panel.getByRole("button", { name: "Réessayer" }).click();
    await expect(panel.locator("li")).toHaveCount(25); expect(state.writes).toEqual([]);
});
test("Read-only collaborators can inspect the blacklist but cannot approve an order", async ({ page }) => {
    const state = await fixture(page, { reader: true }); await page.goto("/admin?tab=orders");
    await page.locator(".dispatch-blacklist summary").click();
    await expect(page.locator(".dispatch-blacklist li")).toHaveCount(25);
    await page.getByRole("button", { name: /Voir les détails/ }).first().click();
    await expect(page.getByRole("button", { name: "Autoriser l’envoi à Olivraison" })).toHaveCount(0);
    expect(state.writes).toEqual([]);
});
test("Blacklisted approval requires explicit confirmation for this order only", async ({ page }) => {
    const state = await fixture(page); await page.goto("/admin?tab=orders");
    await page.getByRole("button", { name: /Voir les détails/ }).first().click();
    const button = page.getByRole("dialog").getByRole("button", { name: "Autoriser l’envoi à Olivraison" });
    page.once("dialog", d => d.dismiss()); await button.click(); expect(state.writes).toEqual([]);
    page.once("dialog", d => { expect(d.message()).toContain("ne débloque pas ses autres commandes"); return d.accept(); });
    await button.click();
    await expect(page.getByRole("dialog")).toContainText("Envoi autorisé manuellement");
    expect(state.writes).toEqual([`/api/orders/${id}/olivraison-approve`]);
});
test("A phone draft edited during a read stays intact for the next search", async ({ page }) => {
    const state = await fixture(page, { slow: true }); await page.goto("/admin?tab=orders");
    const panel = page.locator(".dispatch-blacklist"); await panel.locator("summary").click();
    await expect(panel.locator("li")).toHaveCount(25);
    await panel.locator("#blacklist-phone").fill("1111"); await panel.locator("button[type=submit]").click();
    await panel.locator("#blacklist-phone").fill("9999");
    // Submission is disabled during the read, so preserve the newer draft and submit once the read ends.
    await expect(panel.locator("button[type=submit]")).toBeEnabled(); await panel.locator("button[type=submit]").click();
    await expect(panel.locator("li")).toHaveCount(1); await expect(panel.locator("li")).toContainText("+212699999999");
    expect(state.writes).toEqual([]);
});
