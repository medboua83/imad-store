import { test, expect, type Page } from "@playwright/test";

const instant = new Date("2026-11-24T23:30:00Z"); // Deliberate server/browser calendar disagreement: supplied server bounds must win.
async function fixture(page: Page, ar: boolean, remote: boolean) {
    await page.clock.setFixedTime(instant);
    await page.addInitScript(ar => {
        localStorage.setItem("adminToken", "isolated-today-filter");
        localStorage.setItem("imad-admin-language", ar ? "ar" : "fr");
    }, ar);
    const rows = Array.from({ length: remote ? 126 : 4 }, (_, n) => ({
        id: (n + 1).toString(16).padStart(24, "0"), customerName: `Client fictif ${n}`,
        customerPhone: "+212600000000", city: "Rabat", totalAmount: 230,
        paymentMethod: "COD", paymentStatus: "PENDING", status: n % 2 ? "CONFIRMED" : "PENDING",
        createdAt: n < (remote ? 120 : 2) ? "2026-11-24T23:00:00Z" : "2026-11-24T22:59:59.999Z", items: [],
    }));
    const requests: URL[] = [], writes: string[] = [];
    const control = { failCalendar: false };
    await page.route("**/api/**", route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname;
        if (req.method() !== "GET") { writes.push(path); return route.fulfill({ status: 405 }); }
        requests.push(url);
        if (path === "/api/orders/calendar") return control.failCalendar
            ? route.fulfill({ status: 503 })
            : route.fulfill({ json: { success: true, data: { day: "2026-11-25", start: "2026-11-24T23:00:00Z", end: "2026-11-25T23:00:00Z", timeZone: "Africa/Casablanca" } } });
        if (path === "/api/analytics/summary") {
            const days = Number(url.searchParams.get("days") || 7);
            return route.fulfill({ json: { success: true, data: {
                days, visits: days === 1 ? 3 : 21, productViews: 2, pageViews: 4,
                convertedVisits: 1, attributedOrders: 1, orderRate: 33.33,
                trackingSince: null, products: [],
            } } });
        }
        if (path !== "/api/orders") return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
        const day = (at: string) => at >= "2026-11-24T23:00:00Z" ? "2026-11-25" : "2026-11-24";
        const from = url.searchParams.get("from"), to = url.searchParams.get("to");
        const scope = rows.filter(row => (!from || day(row.createdAt) >= from) && (!to || day(row.createdAt) <= to));
        const filtered = scope.filter(row => !url.searchParams.get("status") || row.status === url.searchParams.get("status"));
        const limit = Number(url.searchParams.get("limit") || 100), current = Number(url.searchParams.get("page") || 1);
        return route.fulfill({ json: { success: true,
            data: filtered.slice((current - 1) * limit, current * limit), total: filtered.length,
            page: current, totalPages: Math.ceil(filtered.length / limit), scopeTotal: scope.length,
            statusCounts: { PENDING: scope.filter(x => x.status === "PENDING").length, CONFIRMED: scope.filter(x => x.status === "CONFIRMED").length },
            trackingFilter: "ALL",
        } });
    });
    return { requests, writes, control };
}
test.use({ timezoneId: "America/Los_Angeles" });
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

for (const width of [320, 1440]) for (const ar of [false, true]) {
    test(`Analytics offers today's calendar period at ${width}px ${ar ? "AR" : "FR"}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const f = await fixture(page, ar, false);
        await page.goto("/admin?tab=analytics");
        const select = page.locator("#analytics-period");
        await expect(select.locator('option[value="1"]')).toHaveText(ar ? "اليوم" : "Aujourd’hui");
        await select.selectOption("1");
        await expect.poll(() => f.requests.some(u => u.pathname === "/api/analytics/summary" && u.searchParams.get("days") === "1")).toBe(true);
        await expect(page.locator(".analytics-kpis article").first().locator("strong")).toHaveText("3");
        await expect(page.locator(".analytics-method")).toContainText(ar ? "منذ منتصف الليل" : "depuis minuit");
        await page.screenshot({ path: info.outputPath("analytics-today.png") });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await select.selectOption("7");
        await expect(page.locator(".analytics-kpis article").first().locator("strong")).toHaveText("21");
        expect(f.writes).toEqual([]);
    });
    for (const remote of [false, true]) {
        test(`Today orders combine with status and reset dates for ${remote ? "full history" : "local collection"} at ${width}px ${ar ? "AR" : "FR"}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 844 });
            const f = await fixture(page, ar, remote);
            await page.goto("/admin?tab=orders");
            const today = page.getByRole("button", { name: ar ? "اليوم" : "Aujourd’hui", exact: true });
            await today.click();
            await expect(today).toHaveAttribute("aria-pressed", "true");
            await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-11-25");
            await expect(page.locator('input[type="date"]').last()).toHaveValue("2026-11-25");
            await expect(page.locator(".admin-order-card")).toHaveCount(remote ? 25 : 2);
            await expect(page.locator(".order-results")).toContainText(remote ? "120" : "2");
            if (remote) await expect.poll(() => f.requests.some(u => u.pathname === "/api/orders" && u.searchParams.get("from") === "2026-11-25" && u.searchParams.get("to") === "2026-11-25")).toBe(true);
            await page.locator(".order-quick-filters button").nth(2).click();
            await expect(page.locator(".admin-order-card")).toHaveCount(remote ? 25 : 1);
            await expect(page.locator(".order-results")).toContainText(remote ? "60" : "1");
            await page.screenshot({ path: info.outputPath("orders-today.png") });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await today.click();
            await expect(today).toHaveAttribute("aria-pressed", "false");
            await expect(page.locator('input[type="date"]').first()).toHaveValue("");
            await expect(page.locator('input[type="date"]').last()).toHaveValue("");
            await expect(page.locator(".order-results")).toContainText(remote ? "63" : "2");
            expect(f.writes).toEqual([]);
        });
    }
}

test("Unavailable store calendar retains dates and allows an explicit retry without writes", async ({ page }) => {
    const f = await fixture(page, false, false);
    f.control.failCalendar = true;
    await page.goto("/admin?tab=orders");
    const today = page.getByRole("button", { name: "Aujourd’hui", exact: true });
    await today.click();
    await expect(page.locator(".admin-orders-workspace [role=alert]")).toContainText("La période n’a pas pu être chargée");
    await expect(page.locator('input[type="date"]').first()).toHaveValue("");
    await expect(today).toBeEnabled();
    f.control.failCalendar = false;
    await today.click();
    await expect(page.locator('input[type="date"]').first()).toHaveValue("2026-11-25");
    await expect(page.locator(".admin-order-card")).toHaveCount(2);
    expect(f.writes).toEqual([]);
});
