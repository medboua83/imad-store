import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function fixture(page: Page, remote = true, locale = "fr") {
    const rows = Array.from({ length: remote ? 125 : 4 }, (_, n) => ({
        id: n === 0 ? "a123456789012345deadbeef" : (n + 1).toString(16).padStart(24, "0"),
        customerName: n === 0 ? "Ancien client fictif" : `Client fictif ${n}`,
        city: "Rabat", status: "SHIPPED", paymentStatus: "PENDING", paymentMethod: "COD",
        totalAmount: 230, shippingCost: 30, items: [],
        createdAt: n === 0 ? "2020-01-01T10:00:00Z" : "2026-11-20T10:00:00Z",
        shipment: n % 4 === 2 ? null : { id: `shipment-${n}`, trackingId: `FICTIF-${n}`,
            carrierStatus: n % 4 === 0 ? "REPORTED" : "TRANSIT", state: "ACTIVE", lastError: null },
    }));
    const exports: URL[] = [], writes: string[] = [], control = { status: 200, delay: 0, wrongType: false };
    await page.addInitScript(locale => {
        localStorage.setItem("adminToken", "isolated-export-test");
        localStorage.setItem("imad-admin-language", locale);
    }, locale);
    function matching(url: URL) {
        const q = url.searchParams;
        return rows.filter(row => (!q.get("search") || (row.id + row.customerName).toLowerCase().includes(q.get("search")!.replace(/^#/, "").toLowerCase()))
            && (!q.get("tracking") || q.get("tracking") === "REPORTED" && row.shipment?.carrierStatus === "REPORTED")
            && (!q.get("from") || row.createdAt.slice(0,10) >= q.get("from")!)
            && (!q.get("to") || row.createdAt.slice(0,10) <= q.get("to")!));
    }
    await page.route("**/api/**", async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== "GET") { writes.push(url.pathname); return route.fulfill({ status: 405 }); }
        if (url.pathname === "/api/orders/export.csv") {
            exports.push(url);
            if (control.delay) await new Promise(r => setTimeout(r, control.delay));
            if (control.status !== 200) return route.fulfill({ status: control.status, json: { success: false } });
            if (control.wrongType) return route.fulfill({ contentType: "text/html", body: "<html>Login</html>" });
            const found = matching(url);
            return route.fulfill({ contentType: "text/csv; charset=utf-8", headers: { "X-Order-Export-Count": String(found.length) },
                body: '\uFEFF"Référence";"Client"\r\n' + found.map(row => `"${row.id}";"${row.customerName}"`).join("\r\n") + "\r\n" });
        }
        if (url.pathname === "/api/orders") {
            const found = matching(url), limit = Number(url.searchParams.get("limit") || 100),
                pages = Math.ceil(found.length / limit), current = Math.min(Number(url.searchParams.get("page") || 1), Math.max(1, pages));
            return route.fulfill({ json: { success: true, data: found.slice((current - 1) * limit, current * limit),
                total: found.length, scopeTotal: found.length, page: current, totalPages: pages,
                statusCounts: { PENDING: 0, CONFIRMED: 0, SHIPPED: found.length, DELIVERED: 0, CANCELLED: 0 },
                trackingFilter: url.searchParams.get("tracking") || "ALL" } });
        }
        return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
    });
    return { exports, writes, control };
}

for (const width of [320, 390, 1440]) test(`Export downloads the complete filtered history, not just the current page, at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page);
    await page.goto("/admin?tab=orders");
    const button = page.getByRole("button", { name: "Exporter CSV", exact: true });
    await expect(button).toBeEnabled();
    const nav = page.getByRole("navigation", { name: "Navigation des commandes, début", exact: true });
    await nav.getByRole("button", { name: "Page suivante" }).click();
    await expect(nav).toContainText("Page 2 sur 5");
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^imad-commandes-\d{4}-\d{2}-\d{2}\.csv$/);
    const file = info.outputPath("all-fictitious-orders.csv"); await download.saveAs(file);
    const csv = await readFile(file, "utf8");
    expect(csv).toContain("deadbeef"); expect(csv.split("\r\n").length - 2).toBe(125);
    expect(f.exports[0].searchParams.has("page")).toBe(false);
    expect(f.exports[0].searchParams.has("limit")).toBe(false);
    await expect(page.getByRole("status").filter({ hasText: "Export prêt : 125" })).toBeVisible();
    await page.getByLabel("Suivi de livraison", { exact: true }).selectOption("REPORTED");
    await page.getByLabel("Rechercher une commande", { exact: true }).fill("#DEADBEEF");
    await page.getByText("Dates et paiement", { exact: true }).click();
    await page.getByLabel("Du", { exact: true }).fill("2020-01-01");
    await page.getByLabel("Au", { exact: true }).fill("2020-01-02");
    await page.getByLabel("Paiement", { exact: true }).selectOption("PENDING");
    await page.getByRole("button", { name: /^Expédiée/ }).click();
    await page.getByLabel("Trier par", { exact: true }).selectOption("oldest");
    await expect(page.locator(".order-results")).toContainText("1 résultat");
    const second = page.waitForEvent("download"); await button.click(); await second;
    expect(Object.fromEntries(f.exports.at(-1)!.searchParams)).toEqual({
        search: "#DEADBEEF", status: "SHIPPED", payment: "PENDING", tracking: "REPORTED",
        from: "2020-01-01", to: "2020-01-02", sort: "oldest", locale: "fr",
    });
    await expect(page.locator(".order-export")).toContainText("Export prêt : 1 commande(s).");
    await page.locator(".order-export").screenshot({ path: info.outputPath("export-control.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.writes).toEqual([]);
});

test("A small complete collection still exports through the authenticated server; empty results produce an empty file", async ({ page }) => {
    const f = await fixture(page, false);
    await page.goto("/admin?tab=orders");
    const button = page.getByRole("button", { name: "Exporter CSV", exact: true });
    const first = page.waitForEvent("download"); await button.click(); await first;
    expect(f.exports).toHaveLength(1);
    await expect(page.locator(".order-export")).toContainText("Export prêt : 4");
    await page.getByLabel("Rechercher une commande", { exact: true }).fill("Aucun résultat");
    const second = page.waitForEvent("download"); await button.click(); await second;
    await expect(page.locator(".order-export")).toContainText("Export prêt : 0");
    expect(f.writes).toEqual([]);
});

test("Export errors preserve filters, do not download an error page, and permit one explicit retry", async ({ page }) => {
    const f = await fixture(page, false), downloads: string[] = [];
    page.on("download", d => downloads.push(d.suggestedFilename()));
    await page.goto("/admin?tab=orders");
    await page.getByLabel("Rechercher une commande", { exact: true }).fill("#DEADBEEF");
    const button = page.getByRole("button", { name: "Exporter CSV", exact: true });
    for (const status of [503, 422]) {
        f.control.status = status; await button.click();
        await expect(page.locator(".order-export [role=alert]")).toContainText(status === 422 ? "Plus de 10 000" : "Vos filtres sont conservés");
        await expect(page.getByLabel("Rechercher une commande", { exact: true })).toHaveValue("#DEADBEEF");
    }
    f.control.status = 200; f.control.wrongType = true;
    await button.click(); await expect(page.locator(".order-export [role=alert]")).toContainText("Export impossible");
    expect(downloads).toEqual([]);
    f.control.wrongType = false;
    const done = page.waitForEvent("download"); await button.click(); await done;
    expect(downloads).toHaveLength(1); expect(f.exports).toHaveLength(4); expect(f.writes).toEqual([]);
});

test("Repeated clicks and changed filters cannot download a stale selection; invalid dates disable export", async ({ page }) => {
    const f = await fixture(page, false), downloads: string[] = [];
    page.on("download", d => downloads.push(d.suggestedFilename()));
    await page.goto("/admin?tab=orders");
    f.control.delay = 650;
    const button = page.getByRole("button", { name: "Exporter CSV", exact: true });
    await button.dblclick();
    await page.getByLabel("Rechercher une commande", { exact: true }).fill("#DEADBEEF");
    await expect(button).toBeEnabled();
    await page.waitForTimeout(900);
    expect(f.exports).toHaveLength(1); expect(downloads).toEqual([]);
    const done = page.waitForEvent("download"); await button.click(); await done;
    await expect(page.locator(".order-export")).toContainText("Export prêt : 1");
    await page.getByText("Dates et paiement", { exact: true }).click();
    await page.getByLabel("Du", { exact: true }).fill("2026-11-23");
    await page.getByLabel("Au", { exact: true }).fill("2026-11-22");
    await expect(button).toBeDisabled();
    expect(f.writes).toEqual([]);
});

test("Arabic export remains readable and requests Arabic column headers on a narrow screen", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const f = await fixture(page, false, "ar");
    await page.goto("/admin?tab=orders");
    const button = page.getByRole("button", { name: "تصدير CSV", exact: true });
    await expect(button).toBeVisible();
    const done = page.waitForEvent("download"); await button.click(); await done;
    expect(f.exports[0].searchParams.get("locale")).toBe("ar");
    await expect(page.locator(".order-export")).toContainText("التصدير جاهز: 4 طلب.");
    await page.locator(".order-export").screenshot({ path: info.outputPath("export-arabic.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
