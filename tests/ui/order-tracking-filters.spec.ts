import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, remote: boolean, locale = "fr") {
    const rows = Array.from({ length: remote ? 125 : 4 }, (_, n) => ({
        id: n === 0 ? "a123456789012345deadbeef" : (n + 1).toString(16).padStart(24, "0"),
        customerName: n === 0 ? "Ancien client fictif" : `Client fictif ${n}`,
        city: "Rabat",
        status: "SHIPPED",
        paymentStatus: "PENDING",
        paymentMethod: "COD",
        totalAmount: 230,
        shippingCost: 30,
        createdAt: n === 0 ? "2020-01-01T10:00:00Z" : "2026-11-20T10:00:00Z",
        items: [],
        shipment:
            n % 4 === 2
                ? null
                : {
                      id: `shipment-${n}`,
                      trackingId: `FICTIF-${n}`,
                      state: n % 4 === 3 ? "ATTENTION" : "ACTIVE",
                      carrierStatus: n % 4 === 0 ? "REPORTED" : "TRANSIT",
                      lastError: n % 4 === 3 ? "Erreur de recette" : null,
                      lastSyncedAt: "2026-11-22T09:00:00Z",
                  },
    }));
    const control = { fail: false, acknowledge: true },
        reads: URL[] = [],
        writes: string[] = [];
    await page.addInitScript((locale) => {
        localStorage.setItem("adminToken", "isolated-tracking-filters");
        localStorage.setItem("imad-admin-language", locale);
    }, locale);
    await page.route("**/api/**", async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (req.method() !== "GET") {
            writes.push(url.pathname);
            return route.fulfill({ status: 405 });
        }
        if (url.pathname.endsWith("/admin-details"))
            return route.fulfill({ json: { success: true, data: rows[0] } });
        if (url.pathname !== "/api/orders")
            return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
        reads.push(url);
        const tracking = url.searchParams.get("tracking") || "ALL",
            search = (url.searchParams.get("search") || "").replace(/^#/, "").toLowerCase();
        if (control.fail && tracking !== "ALL") return route.fulfill({ status: 503 });
        const scope = rows.filter(
            (row) =>
                (!search ||
                    [row.id, row.customerName, row.city].some((value) =>
                        value.toLowerCase().includes(search),
                    )) &&
                (tracking === "ALL" ||
                    (tracking === "REPORTED" && row.shipment?.carrierStatus === "REPORTED") ||
                    (tracking === "UNLINKED" && !row.shipment) ||
                    (tracking === "ATTENTION" &&
                        !!row.shipment &&
                        (row.shipment.carrierStatus === "REPORTED" ||
                            row.shipment.state === "ATTENTION"))),
        );
        const filtered = scope.filter(
            (row) =>
                !url.searchParams.get("status") || row.status === url.searchParams.get("status"),
        );
        filtered.sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id),
        );
        const limit = Number(url.searchParams.get("limit") || 100),
            pages = Math.ceil(filtered.length / limit),
            current = Math.min(Number(url.searchParams.get("page") || 1), Math.max(1, pages));
        const counts = {
            PENDING: 0,
            CONFIRMED: 0,
            SHIPPED: scope.length,
            DELIVERED: 0,
            CANCELLED: 0,
        };
        return route.fulfill({
            json: {
                success: true,
                data: filtered.slice((current - 1) * limit, current * limit),
                total: filtered.length,
                page: current,
                totalPages: pages,
                scopeTotal: scope.length,
                statusCounts: counts,
                ...(control.acknowledge ? { trackingFilter: tracking } : {}),
            },
        });
    });
    return { rows, control, reads, writes };
}
for (const width of [390, 1440])
    for (const remote of [false, true]) {
        test(`Delivery views cover ${remote ? "full history" : "complete local collection"} at ${width}px`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 900 });
            const f = await fixture(page, remote);
            await page.goto("/admin?tab=orders");
            const tracking = page.getByLabel("Suivi de livraison", { exact: true });
            await tracking.selectOption("REPORTED");
            await expect(page.locator(".order-results")).toContainText(
                remote ? "32 résultats" : "1 résultat",
            );
            const cards = page.locator(".admin-order-card");
            await expect(cards).toHaveCount(remote ? 25 : 1);
            await expect(
                cards.first().getByRole("region", { name: "Suivi Olivraison" }),
            ).toContainText("À surveiller");
            if (remote) {
                const nav = page.getByRole("navigation", {
                    name: "Navigation des commandes, début",
                    exact: true,
                });
                await nav.getByRole("button", { name: "Page suivante" }).click();
                await expect(nav).toContainText("Page 2 sur 2");
            }
            await page.getByLabel("Rechercher une commande").fill("#DEADBEEF");
            await expect(cards).toHaveCount(1);
            await expect(cards).toContainText("Ancien client fictif");
            await cards.getByRole("button", { name: /Voir les détails/ }).click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toContainText("En attente de paiement");
            await dialog.getByRole("button", { name: "Fermer les détails" }).click();
            await page.getByLabel("Rechercher une commande").fill("");
            await tracking.selectOption("UNLINKED");
            await expect(page.locator(".order-results")).toContainText(
                remote ? "31 résultats" : "1 résultat",
            );
            await expect(
                cards.first().getByRole("region", { name: "Suivi Olivraison" }),
            ).toHaveCount(0);
            await tracking.selectOption("ATTENTION");
            await expect(page.locator(".order-results")).toContainText(
                remote ? "63 résultats" : "2 résultats",
            );
            await expect(
                page.getByText(
                    "Reports, destinataires injoignables, retours et suivis nécessitant une vérification.",
                    { exact: true },
                ),
            ).toBeVisible();
            expect(f.writes).toEqual([]);
            if (remote)
                expect(
                    f.reads.some(
                        (url) =>
                            url.searchParams.get("tracking") === "REPORTED" &&
                            url.searchParams.get("search") === "#DEADBEEF",
                    ),
                ).toBe(true);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({ path: info.outputPath("tracking-view.png") });
            await tracking.scrollIntoViewIfNeeded();
            await page.screenshot({ path: info.outputPath("tracking-control.png") });
            await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
            await expect(tracking).toHaveValue("ALL");
        });
    }
test("A stale or unacknowledged server view cannot masquerade as filtered results", async ({
    page,
}) => {
    const f = await fixture(page, true);
    await page.goto("/admin?tab=orders");
    await expect(page.locator(".admin-order-card")).toHaveCount(25);
    f.control.acknowledge = false;
    await page.getByLabel("Suivi de livraison", { exact: true }).selectOption("REPORTED");
    await expect(
        page.getByRole("alert").filter({ hasText: "Recherche dans l’historique impossible" }),
    ).toBeVisible();
    await expect(page.locator(".admin-order-card")).toHaveCount(0);
    f.control.acknowledge = true;
    f.control.fail = true;
    await Promise.all([
        page.waitForResponse(response => response.url().includes("tracking=REPORTED") && response.status() === 503),
        page.getByRole("button", { name: "Réessayer", exact: true }).click(),
    ]);
    await expect(page.locator(".admin-order-card")).toHaveCount(0);
    const refresh = page.getByRole("button", { name: "Actualiser", exact: true });
    await expect(refresh).toBeEnabled();
    f.control.fail = false;
    // Automatic recovery may remove the inline retry before a click; the toolbar stays available.
    await refresh.click();
    await expect(page.locator(".order-results")).toContainText("32 résultats");
    expect(f.writes).toEqual([]);
});
test("A resolved tracking issue leaves the view automatically without changing payment or losing the open detail", async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.clock.install();
    const f = await fixture(page, true, "ar");
    await page.goto("/admin?tab=orders");
    const tracking = page.getByLabel("متابعة التوصيل", { exact: true });
    await tracking.selectOption("REPORTED");
    await page.clock.runFor(400);
    await page.getByLabel("البحث عن طلب").fill("#DEADBEEF");
    await page.clock.runFor(400);
    await expect(page.locator(".admin-order-card")).toHaveCount(1);
    await page.getByRole("button", { name: /عرض التفاصيل/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("region", { name: "تتبع Olivraison" })).toContainText(
        "تحتاج إلى متابعة",
    );
    f.rows[0].shipment!.carrierStatus = "TRANSIT";
    await page.clock.runFor(5500);
    await expect(dialog.getByRole("region", { name: "تتبع Olivraison" })).toContainText(
        "قيد التوصيل",
    );
    await expect(dialog.getByText("في انتظار الدفع", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "إغلاق التفاصيل", exact: true }).click();
    await expect(page.locator(".admin-order-card")).toHaveCount(0);
    await expect(tracking).toHaveValue("REPORTED");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
    expect(f.writes).toEqual([]);
});
