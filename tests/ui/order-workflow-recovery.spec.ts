import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, locale = "fr") {
    const rows = Array.from({ length: 51 }, (_, i) => ({
        id: (i + 1).toString(16).padStart(24, "0"),
        customerName: `Client fictif ${i + 1}`,
        city: "Rabat",
        status: "CANCELLED",
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        createdAt: "2026-11-20T10:00:00Z",
        totalAmount: 230,
        shippingCost: 30,
        items: [],
    }));
    const state = {
        failRead: false,
        failPost: false,
        summaryFail: false,
        historyFail: false,
        historyReads: 0,
        posts: [] as string[],
        trashReads: [] as number[],
        historyRows: [
            {
                id: "event",
                type: "status_changed",
                source: "olivraison",
                status: "CANCELLED",
                createdAt: "2026-11-20T10:00:00Z",
            },
        ],
    };
    await page.addInitScript((locale) => {
        localStorage.setItem("adminToken", "isolated-workflow-recovery");
        localStorage.setItem("imad-admin-language", locale);
    }, locale);
    await page.route("**/api/**", async (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (req.method() !== "GET") {
            expect(url.pathname).toBe("/api/orders/trash");
            state.posts.push(req.postData()!);
            if (state.failPost) return route.fulfill({ status: 503 });
            const body = req.postDataJSON();
            expect(body.restore).toBe(true);
            expect(body.ids).toHaveLength(1);
            const index = rows.findIndex((row) => row.id === body.ids[0]);
            if (index >= 0) rows.splice(index, 1);
            return route.fulfill({ json: { success: true, count: index >= 0 ? 1 : 0 } });
        }
        if (url.pathname.endsWith("/history")) {
            state.historyReads++;
            return state.historyFail
                ? route.fulfill({ status: 503 })
                : route.fulfill({ json: { success: true, data: state.historyRows } });
        }
        if (url.pathname === "/api/orders" && url.searchParams.get("trash") === "true") {
            state.trashReads.push(Number(url.searchParams.get("page")));
            if (state.failRead) return route.fulfill({ status: 503 });
            expect(url.searchParams.get("limit")).toBe("25");
            const pages = Math.ceil(rows.length / 25),
                page = Math.min(Number(url.searchParams.get("page") || 1), Math.max(1, pages));
            return route.fulfill({
                json: {
                    success: true,
                    data: rows.slice((page - 1) * 25, page * 25),
                    total: rows.length,
                    page,
                    totalPages: pages,
                },
            });
        }
        if (url.pathname === "/api/orders" && state.summaryFail)
            return route.fulfill({ status: 503 });
        const data =
            url.pathname === "/api/orders"
                ? [
                      {
                          ...rows[0],
                          id: "aaaaaaaaaaaaaaaaaaaaaaaa",
                          shipment: {
                              id: "parcel",
                              trackingId: "FICTIF",
                              state: "ACTIVE",
                              carrierStatus: "RETURNED",
                              lastSyncedAt: "2026-11-20T10:00:00Z",
                              lastError: null,
                          },
                      },
                  ]
                : [];
        return route.fulfill({ json: { success: true, data, total: data.length, unread: 0 } });
    });
    return { rows, state };
}
async function openTrash(page: Page) {
    await page.goto("/admin?tab=orders");
    await page.locator(".order-maintenance summary").click();
    await page.locator(".order-maintenance button").first().click();
    const trash = page.locator(".order-trash");
    await expect(trash).toBeVisible();
    return trash;
}
for (const width of [390, 1440]) {
    test(`Trash replaces pages and clamps after concurrent removals at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page),
            trash = await openTrash(page);
        await expect(trash.locator("article")).toHaveCount(25);
        const navigation = trash.getByRole("navigation");
        await navigation.getByRole("button", { name: "Page suivante" }).click();
        await expect(navigation).toContainText("Page 2 sur 3");
        await expect(trash.locator("article").first()).toContainText("Client fictif 26");
        f.rows.splice(25); // A different administrator removes the last two pages.
        await navigation.getByRole("button", { name: "Page suivante" }).click();
        await expect(navigation).toHaveCount(0);
        await expect(trash.locator("article")).toHaveCount(25);
        await expect(trash.locator("article").first()).toContainText("Client fictif 1");
        expect(new Set(await trash.locator("article strong").allTextContents()).size).toBe(25);
        expect(f.state.posts).toHaveLength(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath("trash.png"), fullPage: true });
    });
    test(`Confirmed restoration survives a failed list refresh without another POST at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const f = await fixture(page),
            trash = await openTrash(page);
        await expect(trash.locator("article")).toHaveCount(25);
        page.on("dialog", (dialog) => dialog.accept());
        f.state.failRead = true;
        await trash.locator("article").first().getByRole("button").click();
        await expect(trash.getByRole("alert")).toContainText(
            "Commande restaurée. La liste n’a pas pu être actualisée",
        );
        await expect(trash.locator("article").first()).toContainText("Client fictif 2");
        await expect(trash.locator("article").first().getByRole("button")).toBeDisabled();
        f.state.failRead = false;
        await trash.getByRole("button", { name: "Actualiser", exact: true }).click();
        await expect(trash.getByRole("alert")).toHaveCount(0);
        await expect(trash.locator("article")).toHaveCount(25);
        expect(f.state.posts).toHaveLength(1);
        expect(
            f.rows.every(
                (row) =>
                    row.paymentStatus === "PENDING" &&
                    row.totalAmount === 230 &&
                    row.status === "CANCELLED",
            ),
        ).toBe(true);
    });
    test(`Detail close stays visible and history supports keyboard and retry at ${width}px`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 700 });
        const f = await fixture(page);
        f.state.historyFail = true;
        await page.goto("/admin?tab=orders&order=aaaaaaaaaaaaaaaaaaaaaaaa");
        const dialog = page.getByRole("dialog"),
            summary = dialog.locator(".order-history summary");
        await expect(summary).toBeVisible();
        expect(f.state.historyReads).toBe(0);
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(dialog.getByRole("alert")).toContainText("Historique indisponible");
        f.state.historyFail = false;
        await dialog.getByRole("button", { name: "Réessayer", exact: true }).click();
        await expect(dialog.locator(".order-history time")).toBeVisible();
        await expect(dialog).toContainText("Le suivi du colis reste disponible");
        await expect(dialog.getByRole("region", { name: "Suivi Olivraison" })).toContainText(
            "Retourné",
        );
        await dialog.evaluate((node) => {
            node.scrollTop = node.scrollHeight;
        });
        const close = dialog.getByRole("button", { name: "Fermer les détails" });
        await expect(close).toBeInViewport();
        const head = await dialog.locator("header").boundingBox(),
            box = await dialog.boundingBox();
        expect(Math.abs(head!.y - box!.y)).toBeLessThan(3);
        await page.screenshot({ path: info.outputPath("detail-scrolled.png") });
        await close.click();
        await expect(dialog).not.toBeVisible();
        expect(f.state.posts).toHaveLength(0);
    });
}
test("Unconfirmed restoration and initial read failures require a safe read retry", async ({
    page,
}) => {
    const f = await fixture(page);
    f.state.failRead = true;
    const trash = await openTrash(page);
    await expect(trash.getByRole("alert")).toContainText("Corbeille indisponible");
    await expect(trash.getByText("La corbeille est vide.")).toHaveCount(0);
    await expect(trash.getByText(/0 sur 0/)).toHaveCount(0);
    f.state.failRead = false;
    await trash.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(trash.locator("article")).toHaveCount(25);
    f.state.failPost = true;
    page.on("dialog", (dialog) => dialog.accept());
    await trash.locator("article").first().getByRole("button").click();
    await expect(trash.getByRole("alert")).toContainText("Restauration non confirmée");
    await expect(trash.locator("article").first().getByRole("button")).toBeDisabled();
    f.state.failPost = false;
    await trash.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(trash.locator("article").first().getByRole("button")).toBeEnabled();
    expect(f.state.posts).toHaveLength(1);
});
test("Restore preserves the page and handles an already restored row on narrow Arabic layout", async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const f = await fixture(page, "ar"),
        trash = await openTrash(page);
    await expect(trash.locator("article")).toHaveCount(25);
    await trash.getByRole("navigation").getByRole("button").last().click();
    await expect(trash.getByRole("navigation")).toContainText("2");
    const id = f.rows[25].id;
    f.rows.splice(25, 1); // Already restored by another administrator.
    page.on("dialog", (dialog) => dialog.accept());
    await trash
        .getByRole("button", { name: `استعادة الطلب #${id.slice(-8).toUpperCase()}`, exact: true })
        .click();
    await expect(
        trash.getByRole("status").filter({ hasText: "تمت استعادة هذا الطلب مسبقاً." }),
    ).toBeVisible();
    expect(f.state.trashReads.at(-1)).toBe(2);
    await expect(trash.locator("article")).toHaveCount(25);
    expect(f.state.posts).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
    await page.screenshot({ path: info.outputPath("trash-arabic.png"), fullPage: true });
});
test("The last trash page clamps after its final row is restored", async ({ page }) => {
    const f = await fixture(page),
        trash = await openTrash(page);
    await expect(trash.locator("article")).toHaveCount(25);
    const next = trash.getByRole("navigation").getByRole("button", { name: "Page suivante" });
    await next.click();
    await expect(trash.getByRole("navigation")).toContainText("Page 2 sur 3");
    await next.click();
    await expect(trash.locator("article")).toHaveCount(1);
    page.on("dialog", (dialog) => dialog.accept());
    await trash.locator("article").getByRole("button").click();
    await expect(trash.getByRole("navigation")).toContainText("Page 2 sur 2");
    await expect(trash.locator("article")).toHaveCount(25);
    expect(f.state.posts).toHaveLength(1);
    expect(f.state.trashReads.at(-1)).toBe(3);
});
test("Arabic history has an explicit empty state and closes by keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const f = await fixture(page, "ar");
    f.state.historyRows = [];
    await page.goto("/admin?tab=orders&order=aaaaaaaaaaaaaaaaaaaaaaaa");
    const dialog = page.getByRole("dialog"),
        summary = dialog.locator(".order-history summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.locator(".order-history")).toContainText("لا توجد أحداث مسجلة لهذا الطلب.");
    expect(f.state.historyReads).toBe(1);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.locator(".order-history")).not.toHaveAttribute("open", "");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
    expect(f.state.posts).toHaveLength(0);
});

test("A parent summary outage does not invalidate a confirmed restoration", async ({ page }) => {
    const f = await fixture(page),
        trash = await openTrash(page);
    await expect(trash.locator("article")).toHaveCount(25);
    f.state.summaryFail = true;
    page.on("dialog", (dialog) => dialog.accept());
    await trash.locator("article").first().getByRole("button").click();
    await expect(
        trash.getByRole("status").filter({ hasText: "Commande restaurée." }),
    ).toBeVisible();
    await expect(
        trash
            .getByRole("status")
            .filter({ hasText: "Le résumé des commandes sera actualisé à votre retour." }),
    ).toBeVisible();
    await expect(trash.getByRole("alert")).toHaveCount(0);
    await expect(trash.locator("article").first().getByRole("button")).toBeEnabled();
    expect(f.state.posts).toHaveLength(1);
});
