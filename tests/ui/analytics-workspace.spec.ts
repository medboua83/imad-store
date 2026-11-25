import { test, expect, type Page } from "@playwright/test";

function summary(days: number, visits = days === 1 ? 0 : 120) {
    return { days, visits, pageViews: visits + 50, productViews: visits + 20, convertedVisits: visits ? 4 : 0,
        attributedOrders: visits ? 6 : 0, orderRate: visits ? 3.33 : null,
        start: days === 1 ? "2026-11-25T00:00:00Z" : new Date(Date.parse("2026-11-25T10:00:00Z") - days * 86400_000).toISOString(), end: "2026-11-25T10:00:00Z", trackingSince: null, products: [],
        funnel: { cartVisits: 10, checkoutVisits: 6, confirmedOrders: 3, shippedOrders: 2, deliveredOrders: 1, cancelledOrders: 1, unknownOrders: 0 } };
}
async function fixture(page: Page, ar = false, analyticsOnly = false) {
    const control = { fail: false, wrongPeriod: false, hold: 0, requests: [] as number[], writes: [] as string[], reads: [] as string[] };
    const payload = Buffer.from(JSON.stringify({ id: "a".repeat(24), role: analyticsOnly ? "STAFF" : "ADMIN", permissions: analyticsOnly ? ["analytics.read"] : [] })).toString("base64url");
    await page.addInitScript(({ token, ar }) => {
        localStorage.setItem("adminToken", token);
        localStorage.setItem("imad-admin-language", ar ? "ar" : "fr");
    }, { token: `fixture.${payload}.fixture`, ar });
    await page.route("**/api/**", async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== "GET") { control.writes.push(url.pathname); return route.fulfill({ status: 405 }); }
        control.reads.push(url.pathname);
        if (url.pathname === "/api/analytics/summary") {
            const days = Number(url.searchParams.get("days") || 7);
            control.requests.push(days);
            const fail = control.fail, wrong = control.wrongPeriod;
            if (control.hold === days) await new Promise(resolve => setTimeout(resolve, 600));
            return fail ? route.fulfill({ status: 503 }) : route.fulfill({ json: { success: true, data: summary(wrong ? 90 : days) } });
        }
        return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
    });
    return control;
}

test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });
for (const width of [320, 390, 768, 1440]) for (const ar of [false, true]) {
    test(`Statistics put figures before explanations at ${width}px ${ar ? "AR" : "FR"}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        const c = await fixture(page, ar);
        await page.goto("/admin?tab=analytics");
        const cards = page.locator(".analytics-kpis article");
        await expect(cards).toHaveCount(4);
        await expect(cards.first().locator("strong")).toHaveText("120");
        await expect(page.locator(".analytics-attributed-orders strong")).toHaveText("6");
        const first = await cards.first().locator("strong").boundingBox();
        expect(first!.y + first!.height).toBeLessThan(604);
        if (width < 1101) {
            const a = await cards.nth(0).boundingBox(), b = await cards.nth(1).boundingBox();
            expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
        }
        await expect(page.locator(".analytics-freshness")).toContainText(ar ? "بتوقيت المغرب" : "heure du Maroc");
        await page.screenshot({ path: info.outputPath("statistics.png") });
        const details = page.locator(".analytics-method details");
        await expect(details).not.toHaveAttribute("open", "");
        await details.locator("summary").focus(); await page.keyboard.press("Enter");
        await expect(details).toHaveAttribute("open", "");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole("button", { name: ar ? "إدارة الطلبات" : "Gérer les commandes", exact: true }).click();
        await expect(page).toHaveURL(/tab=orders/);
        expect(c.writes).toEqual([]);
    });
}

test("A failed refresh retains its period and read time, then a new period hides stale values", async ({ page }) => {
    const c = await fixture(page); await page.goto("/admin?tab=analytics");
    await expect(page.locator(".analytics-kpis strong").first()).toHaveText("120");
    const stamp = await page.locator(".analytics-freshness").textContent();
    c.fail = true; await page.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(page.locator(".admin-analytics [role=alert]")).toContainText("restent affichées");
    await expect(page.locator(".analytics-kpis strong").first()).toHaveText("120");
    await expect(page.locator(".analytics-freshness")).toHaveText(stamp!);
    await page.locator("#analytics-period").selectOption("30");
    await expect(page.locator(".admin-analytics [role=alert]")).toContainText("n’ont pas pu être chargées");
    await expect(page.locator(".analytics-kpis")).toHaveCount(0);
    await expect(page.locator(".analytics-freshness")).toHaveCount(0);
    c.fail = false; await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await expect(page.locator(".analytics-kpis strong").first()).toHaveText("120");
    await expect(page.locator(".admin-analytics [role=alert]")).toHaveCount(0);
    await page.locator("#analytics-period").selectOption("1");
    await expect(page.locator(".analytics-empty")).toContainText("Aucune visite mesurée sur cette période");
    await expect(page.locator(".analytics-kpis strong").first()).toHaveText("0");
    expect(c.writes).toEqual([]);
});

test("Late responses and mismatched server periods cannot replace selected figures", async ({ page }) => {
    const c = await fixture(page); await page.goto("/admin?tab=analytics");
    await expect(page.locator(".analytics-kpis article")).toHaveCount(4);
    const late = page.waitForResponse(r => new URL(r.url()).searchParams.get("days") === "30");
    c.hold = 30; await page.locator("#analytics-period").selectOption("30");
    await expect.poll(() => c.requests.includes(30)).toBe(true);
    await page.locator("#analytics-period").selectOption("1");
    await expect(page.locator(".analytics-kpis strong").first()).toHaveText("0");
    await late;
    await expect(page.locator(".analytics-kpis strong").first()).toHaveText("0");
    c.wrongPeriod = true; await page.locator("#analytics-period").selectOption("7");
    await expect(page.locator(".admin-analytics [role=alert]")).toBeVisible();
    await expect(page.locator(".analytics-kpis")).toHaveCount(0);
    expect(c.writes).toEqual([]);
});

test("An analytics-only collaborator has no Orders shortcut or unauthorized order reads", async ({ page }) => {
    const c = await fixture(page, false, true); await page.goto("/admin?tab=analytics");
    await expect(page.locator(".analytics-kpis article")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Gérer les commandes", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Commandes", exact: true })).toHaveCount(0);
    expect(c.reads.some(path => path.startsWith("/api/orders"))).toBe(false);
    expect(c.writes).toEqual([]);
});

test("Browser protections allow app hydration but block framing, eval and an unrelated script host", async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    let unrelatedRequests = 0;
    await page.route("https://unrelated.example.test/**", route => { unrelatedRequests++; return route.abort(); });
    const response = await page.goto("/shop");
    expect(response!.headers()["x-frame-options"]).toBe("DENY");
    expect(response!.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response!.headers()["content-security-policy"]).not.toContain("'unsafe-eval'");
    // DevTools evaluation bypasses unsafe-eval, including synchronously inserted
    // scripts. Load the probe through the normal page script loader instead.
    await page.route("**/__csp-probe.js", route => route.fulfill({
        contentType: "application/javascript",
        body: "try { new Function('return 7')(); window.__storeEvalBlocked=false; } catch { window.__storeEvalBlocked=true; }",
    }));
    await page.evaluate(() => {
        const script = document.createElement("script");
        script.src = "/__csp-probe.js";
        document.head.appendChild(script);
    });
    await expect.poll(() => page.evaluate(() =>
        (window as unknown as { __storeEvalBlocked?: boolean }).__storeEvalBlocked,
    )).toBe(true);
    const directive = await page.evaluate(() => new Promise<string>(resolve => {
        document.addEventListener("securitypolicyviolation", event => {
            if (event.blockedURI.startsWith("https://unrelated.example.test")) resolve(event.effectiveDirective);
        });
        const script = document.createElement("script"); script.src = "https://unrelated.example.test/script.js"; document.head.appendChild(script);
    }));
    expect(directive).toContain("script-src"); expect(unrelatedRequests).toBe(0);
    await page.getByRole("button", { name: "البحث في المتجر", exact: true }).click();
    await expect(page.locator('input[type="search"]:visible').first()).toBeVisible();
    expect(errors).toEqual([]);
});
