import { test, expect, type Page } from "@playwright/test";

async function admin(page: Page) {
    const writes: string[] = [],
        periods: string[] = [];
    await page.addInitScript(() => localStorage.setItem("adminToken", "isolated-filter-context"));
    await page.route("**/api/**", async (route) => {
        const request = route.request(),
            url = new URL(request.url());
        if (request.method() !== "GET") {
            writes.push(url.pathname);
            return route.fulfill({ status: 405 });
        }
        let data: unknown = [];
        if (url.pathname === "/api/orders")
            data = [
                {
                    id: "777777777777777777777771",
                    customerName: "Client fictif",
                    customerPhone: "+212600000099",
                    city: "Rabat",
                    status: "PENDING",
                    paymentStatus: "PENDING",
                    paymentMethod: "COD",
                    totalAmount: 230,
                    shippingCost: 0,
                    createdAt: "2026-11-05T10:00:00Z",
                    items: [],
                },
            ];
        if (url.pathname === "/api/analytics/summary") {
            periods.push(url.searchParams.get("days") || "");
            data = {
                days: Number(url.searchParams.get("days")),
                visits: 3,
                pageViews: 5,
                productViews: 0,
                convertedVisits: 0,
                orderRate: 0,
                attributedOrders: 0,
                trackingSince: null,
                products: [],
            };
        }
        await route.fulfill({
            json: { success: true, data, total: Array.isArray(data) ? data.length : 0, unread: 0 },
        });
    });
    return { writes, periods };
}
async function section(page: Page, name: string) {
    const menu = page.locator(".admin-mobile-menu");
    if ((await menu.isVisible()) && (await menu.getAttribute("aria-expanded")) === "false")
        await menu.click();
    await page.locator("#admin-navigation").getByRole("button", { name, exact: true }).click();
}

for (const width of [390, 1440]) {
    test(`Order search, dates, payment and sort survive section navigation at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const { writes } = await admin(page);
        await page.goto("/admin?tab=orders");
        const search = page.getByRole("searchbox", {
            name: "Rechercher une commande",
            exact: true,
        });
        await search.fill("Rabat");
        await page
            .locator(".order-quick-filters button")
            .filter({ hasText: "À confirmer" })
            .click();
        await page.getByRole("combobox", { name: "Trier par", exact: true }).selectOption("amount");
        await page.getByText("Dates et paiement", { exact: true }).click();
        await page.getByLabel("Du", { exact: true }).fill("2026-11-01");
        await page.getByLabel("Au", { exact: true }).fill("2026-11-30");
        await page.getByRole("combobox", { name: "Paiement", exact: true }).selectOption("PENDING");
        await expect(page.locator(".order-results")).toContainText("1 résultat");
        await section(page, "Produits");
        await page.goBack();
        await expect(search).toHaveValue("Rabat");
        await expect(page.getByRole("combobox", { name: "Trier par", exact: true })).toHaveValue(
            "amount",
        );
        await expect(
            page.locator(".order-quick-filters button").filter({ hasText: "À confirmer" }),
        ).toHaveAttribute("aria-pressed", "true");
        await page.locator(".order-extra-filters summary").click();
        await expect(page.getByLabel("Du", { exact: true })).toHaveValue("2026-11-01");
        await expect(page.getByLabel("Au", { exact: true })).toHaveValue("2026-11-30");
        await expect(page.getByRole("combobox", { name: "Paiement", exact: true })).toHaveValue(
            "PENDING",
        );
        await expect(page.locator(".order-results")).toContainText("1 résultat");
        await page.getByRole("button", { name: "Réinitialiser les filtres", exact: true }).click();
        await expect(search).toHaveValue("");
        expect(writes).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });

    test(`Analytics keeps its selected period after navigation and browser history at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const { writes, periods } = await admin(page);
        await page.goto("/admin?tab=analytics");
        const period = page.getByLabel("Période", { exact: true });
        await period.selectOption("90");
        await expect.poll(() => periods.at(-1)).toBe("90");
        await section(page, "Produits");
        await page.goBack();
        await expect(period).toHaveValue("90");
        await expect.poll(() => periods.at(-1)).toBe("90");
        expect(writes).toEqual([]);
    });
}

test("A new admin session clears the previous order search and analytics period", async ({ page }) => {
    const { writes } = await admin(page);
    await page.route("**/api/auth/login", route => route.fulfill({ json: {
        success: true, data: { accessToken: "new-isolated-session", refreshToken: "new-isolated-refresh" },
    } }));
    await page.goto("/admin?tab=orders");
    await page.getByRole("searchbox", { name: "Rechercher une commande", exact: true }).fill("Rabat");
    await section(page, "Statistiques");
    await page.getByLabel("Période", { exact: true }).selectOption("90");
    await page.evaluate(() => window.dispatchEvent(new Event("imad:session-expired")));
    await page.getByLabel("Adresse e-mail", { exact: true }).fill("fixture@example.invalid");
    await page.getByLabel("Mot de passe", { exact: true }).fill("fictional-local-fixture-only");
    await page.getByRole("button", { name: "Se connecter", exact: true }).click();
    await expect(page.getByLabel("Période", { exact: true })).toHaveValue("7");
    await section(page, "Commandes");
    await expect(page.getByRole("searchbox", { name: "Rechercher une commande", exact: true })).toHaveValue("");
    expect(writes).toEqual([]);
});

for (const width of [320, 390, 1280]) {
    test(`Gallery of 25 photos keeps the selected thumbnail visible without moving the page at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/products/fixture-gallery-long");
        const strip = page.locator(".gallery-thumbnails");
        const next = page
            .locator(".gallery-caption")
            .getByRole("button", { name: "الصورة التالية", exact: true });
        const visible = () =>
            strip.evaluate((el) => {
                const box = el.getBoundingClientRect(),
                    selected = el.querySelector('[aria-pressed="true"]')!.getBoundingClientRect();
                return selected.left >= box.left - 1 && selected.right <= box.right + 1;
            });
        await next.focus();
        const initialY = await page.evaluate(() => scrollY);
        await next.press("End");
        await expect(
            page.getByRole("button", { name: "عرض الصورة 25", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect.poll(visible).toBe(true);
        await expect(next).toBeFocused();
        expect(await page.evaluate(() => scrollY)).toBe(initialY);
        await next.press("Home");
        const first = page.getByRole("button", { name: "عرض الصورة 1", exact: true });
        await expect.poll(visible).toBe(true);
        await first.focus();
        await first.press("End");
        const last = page.getByRole("button", { name: "عرض الصورة 25", exact: true });
        await expect(last).toBeFocused();
        await expect.poll(visible).toBe(true);
        if (width === 1280) {
            await page.setViewportSize({ width: 390, height: 900 });
            await expect.poll(visible).toBe(true);
            await page.setViewportSize({ width, height: 900 });
            await expect.poll(visible).toBe(true);
        }
        await last.press("Home");
        await expect(first).toBeFocused();
        await expect.poll(visible).toBe(true);
        await page.screenshot({ path: info.outputPath(`gallery-strip-${width}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
}
