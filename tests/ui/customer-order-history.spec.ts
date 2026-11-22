import { test, expect, type Page } from "@playwright/test";

const anchor = "a123456789012345deadbeef";
const hid = (n: number) => n === 0 ? anchor : (10000+n).toString(16).padStart(24, "0");
async function fixture(page: Page, remote = false, locale = "fr") {
    const rows = Array.from({ length: remote ? 125 : 4 }, (_, n) => ({
        id: n === 0 ? anchor : (n+1).toString(16).padStart(24, "0"), customerName: `Client fictif ${n}`,
        customerPhone: n === 0 ? "+212600000099" : "+212611111111", city: "Rabat", region: "Rabat",
        status: "PENDING", paymentStatus: "PENDING", paymentMethod: "COD", totalAmount: 230, shippingCost: 30,
        createdAt: "2026-11-22T10:00:00Z", items: [],
        customerHistory: { available: true, priorCancelledCount: n === 0 ? 3 : 0 },
    }));
    const control = { fail: false, acknowledge: true, delay: 0, prior: 3 }, reads: URL[] = [], writes: string[] = [];
    await page.addInitScript(locale => {
        localStorage.setItem("adminToken", "isolated-customer-history"); localStorage.setItem("imad-admin-language", locale);
    }, locale);
    await page.route("**/api/**", async route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() !== "GET") { writes.push(url.pathname); return route.fulfill({ status: 405 }); }
        reads.push(url);
        if (url.pathname.endsWith("/customer-history")) {
            const orderId = url.pathname.split("/").at(-2)!;
            if (control.delay && orderId === anchor) await new Promise(r => setTimeout(r, control.delay));
            if (control.fail) return route.fulfill({ status: 503 });
            const all = orderId === anchor ? Array.from({ length: 132 }, (_, n) => ({
                id: hid(n), createdAt: n === 0 ? rows[0].createdAt : "2025-01-01T10:00:00Z",
                status: n === 0 ? "PENDING" : n <= control.prior ? "CANCELLED" : "DELIVERED",
                paymentStatus: "PENDING", totalAmount: 230, deletedAt: n === 2 ? "2026-11-01T10:00:00Z" : null,
                cancelledAt: n === 1 && control.prior > 0 ? "2025-01-02T10:00:00Z" : null,
            })) : [{ id: orderId, createdAt: rows[0].createdAt, status: "PENDING", paymentStatus: "PENDING", totalAmount: 230, deletedAt: null, cancelledAt: null }];
            const totalPages = Math.ceil(all.length / 25), current = Math.min(Number(url.searchParams.get("page") || 1), totalPages);
            return route.fulfill({ json: { success: true, anchorOrderId: control.acknowledge ? orderId : rows[2].id,
                phone: orderId === anchor ? "+212600000099" : "+212611111111", priorCancelledCount: orderId === anchor ? control.prior : 0,
                total: all.length, page: current, totalPages, data: all.slice((current-1)*25,current*25) } });
        }
        if (url.pathname.endsWith("/admin-details")) {
            const id = url.pathname.split("/").at(-2)!;
            const order = rows.find(row => row.id === id) || { ...rows[1], id, status: "DELIVERED" };
            return route.fulfill({ json: { success: true, data: { ...order, customerHistory: { ...order.customerHistory, priorCancelledCount: id === anchor ? control.prior : 0 } } } });
        }
        if (url.pathname === "/api/orders") {
            const found = rows.map(row => ({ ...row, customerHistory: { ...row.customerHistory, priorCancelledCount: row.id === anchor ? control.prior : 0 } }));
            const limit = Number(url.searchParams.get("limit") || 100), pages = Math.ceil(found.length / limit), current = Math.min(Number(url.searchParams.get("page") || 1), pages);
            return route.fulfill({ json: { success: true, data: found.slice((current-1)*limit,current*limit), total: found.length,
                scopeTotal: found.length, page: current, totalPages: pages,
                statusCounts: { PENDING: found.length, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 }, trackingFilter: "ALL" } });
        }
        return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
    });
    return { rows, control, reads, writes };
}

for (const width of [320,390,1440]) test(`Earlier cancellations show an orange marker and one accessible history sheet at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page, width === 1440);
    await page.goto('/admin?tab=orders');
    const card = page.locator('.admin-order-card').first();
    await expect(card).toHaveClass(/has-cancellation-history/);
    await expect(card).toContainText('À confirmer');
    await expect(card.getByRole('button', { name: 'Confirmer', exact: true })).toBeEnabled();
    await expect(page.locator('.admin-order-card').nth(1)).not.toHaveClass(/has-cancellation-history/);
    expect(f.reads.filter(u => u.pathname.endsWith('/customer-history'))).toHaveLength(0);
    await card.screenshot({ path: info.outputPath('orange-marker.png') });
    await card.getByRole('button', { name: 'Voir l’historique du numéro' }).click();
    const dialog = page.getByRole('dialog'), title = dialog.getByRole('heading', { name: 'Historique du numéro', exact: true });
    await expect(title).toBeFocused();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(dialog).toContainText('132 commande(s) associée(s)');
    await expect(dialog).toContainText('Annulée le');
    const trashed = dialog.locator('.customer-history-list > li').filter({ hasText: hid(2).slice(-8).toUpperCase() });
    await expect(trashed).toContainText('Conservée dans la corbeille');
    await expect(trashed).toContainText('Date d’annulation non renseignée');
    await expect(trashed.getByRole('button')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Revenir à la commande' }).click();
    await expect(dialog.getByRole('heading', { name: '#DEADBEEF', exact: true })).toBeFocused();
    await expect(dialog).toContainText('En attente de paiement');
    await dialog.getByRole('button', { name: 'Voir l’historique du numéro' }).click();
    await expect(title).toBeFocused();
    const nav = dialog.getByRole('navigation', { name: 'Navigation de l’historique du numéro' });
    await nav.getByRole('button', { name: 'Page suivante' }).click();
    await expect(nav).toContainText('Page 2 sur 6');
    await expect(dialog.locator('.customer-history-list > li')).toHaveCount(25);
    await expect(dialog.locator('.customer-history-list')).not.toContainText(hid(1).slice(-8).toUpperCase());
    await dialog.screenshot({ path: info.outputPath('customer-history.png') });
    const previousOrder = dialog.locator('.customer-history-list > li').first();
    await previousOrder.getByRole('button', { name: /Voir les détails/ }).click();
    await expect(dialog.getByRole('heading', { name: '#' + hid(25).slice(-8).toUpperCase(), exact: true })).toBeVisible();
    await expect(dialog).toContainText('En attente de paiement');
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
    expect(f.writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Failed or unrelated customer history cannot display another number and late requests are discarded on close', async ({ page }) => {
    const f = await fixture(page); f.control.fail = true;
    await page.goto('/admin?tab=orders');
    await page.locator('.admin-order-card').first().getByRole('button', { name: 'Voir l’historique du numéro' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('alert')).toContainText('Historique du numéro indisponible');
    await expect(dialog.locator('.customer-history-list')).toHaveCount(0);
    f.control.fail = false; f.control.acknowledge = false;
    await dialog.getByRole('button', { name: 'Réessayer' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.locator('.customer-history-list')).toHaveCount(0);
    f.control.acknowledge = true;
    await dialog.getByRole('button', { name: 'Réessayer' }).click();
    await expect(dialog).toContainText('132 commande(s) associée(s)');
    f.control.delay = 800;
    await dialog.getByRole('button', { name: 'Page suivante' }).click();
    await page.keyboard.press('Escape');
    await page.locator('.admin-order-card').nth(1).getByRole('button', { name: /Voir les détails/ }).click();
    await dialog.getByRole('button', { name: 'Voir l’historique du numéro' }).click();
    await expect(dialog).toContainText('+212611111111');
    await expect(dialog).toContainText('1 commande(s) associée(s)');
    await page.waitForTimeout(1000);
    await expect(dialog).not.toContainText('132 commande(s)');
    expect(f.writes).toEqual([]);
});

test('History and marker refresh when a previous cancellation is corrected without confirming the new order', async ({ page }) => {
    const f = await fixture(page);
    await page.goto('/admin?tab=orders');
    await page.locator('.admin-order-card').first().getByRole('button', { name: 'Voir l’historique du numéro' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('3 commande(s) plus ancienne(s)');
    f.control.prior = 0;
    await expect(dialog).toContainText('0 commande(s) plus ancienne(s)', { timeout: 9000 });
    await dialog.getByRole('button', { name: 'Revenir à la commande' }).click();
    await expect(dialog).toContainText('À confirmer');
    await expect(dialog.getByRole('button', { name: 'Confirmer', exact: true })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.locator('.admin-order-card').first()).not.toHaveClass(/has-cancellation-history/, { timeout: 9000 });
    expect(f.writes).toEqual([]);
});

test('Arabic cancellation warning and history are readable on mobile without nesting dialogs', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const f = await fixture(page, false, 'ar');
    await page.goto('/admin?tab=orders');
    await page.locator('.admin-order-card').first().getByRole('button', { name: 'عرض سجل الرقم' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'سجل الرقم', exact: true })).toBeFocused();
    await expect(dialog).toContainText('132');
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await dialog.screenshot({ path: info.outputPath('customer-history-arabic.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape'); expect(f.writes).toEqual([]);
});

test('Incomplete numbers cannot produce a cancellation marker or a misleading history button', async ({ page }) => {
    const f = await fixture(page); f.rows[0].customerHistory.available = false;
    await page.goto('/admin?tab=orders');
    const card = page.locator('.admin-order-card').first();
    await expect(card).not.toHaveClass(/has-cancellation-history/);
    await card.getByRole('button', { name: /Voir les détails/ }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Voir l’historique du numéro' })).toHaveCount(0);
    expect(f.reads.filter(u => u.pathname.endsWith('/customer-history'))).toHaveLength(0);
    expect(f.writes).toEqual([]);
});
