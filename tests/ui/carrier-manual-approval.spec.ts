import { test, expect, type Page } from '@playwright/test';
const id = 'a123456789012345deadbeef';
async function fixture(page: Page, options: { fail?: boolean; reader?: boolean; ar?: boolean; tracking?: boolean } = {}) {
    let approved = false; const writes: string[] = [];
    await page.addInitScript(options => { localStorage.setItem('adminToken', 'x.' + btoa(JSON.stringify({ role: options.reader ? 'STAFF' : 'ADMIN', permissions: options.reader ? ['orders.read'] : [] })) + '.x'); localStorage.setItem('imad-admin-language', options.ar ? 'ar' : 'fr'); }, options);
    const row = () => ({ id, status: 'CONFIRMED', confirmationMethod: 'SITE', paymentMethod: 'COD', paymentStatus: 'PENDING',
        totalAmount: 230, shippingCost: 30, customerName: 'TEST FICTIF', customerPhone: '+212600000099', city: 'Rabat', createdAt: '2026-11-22T10:00:00Z', items: [],
        customerHistory: { available: true, priorCancelledCount: 5 },
        shipment: { id, state: options.tracking ? 'ACTIVE' : approved ? 'QUEUED' : 'REVIEW_REQUIRED', trackingId: options.tracking ? 'TEST-EXISTING' : null,
            carrierStatus: options.tracking ? 'PICKUP' : null, approvedAt: approved ? '2026-11-22T12:00:00Z' : null, lastError: null, lastSyncedAt: null } });
    await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
            writes.push(path);
            if (path.endsWith('/olivraison-approve')) {
                expect(req.postDataJSON()).toEqual({ approve: true });
                if (options.fail) return route.fulfill({ status: 503, json: { success: false } });
                await new Promise(r => setTimeout(r, 250)); approved = true;
                return route.fulfill({ json: { success: true, data: { approved: true, orderId: id } } });
            }
            return route.fulfill({ status: 405 });
        }
        if (path === '/api/auth/me') return route.fulfill({ json: { success: true, data: { id: '111111111111111111111111', email: 'test@example.invalid', role: options.reader ? 'STAFF' : 'ADMIN', permissions: options.reader ? ['orders.read'] : [], firstName: 'Test', lastName: 'Owner' } } });
        if (path === '/api/orders') return route.fulfill({ json: { success: true, data: [row()], total: 1, scopeTotal: 1, totalPages: 1, page: 1, statusCounts: { CONFIRMED: 1 }, trackingFilter: 'ALL' } });
        if (path.endsWith('/admin-details')) return route.fulfill({ json: { success: true, data: row() } });
        return route.fulfill({ json: { success: true, data: [], total: 0, unread: 0 } });
    });
    return { writes };
}
for (const width of [320,390,1440]) test(`Manual carrier review stays visible and approval is explicit and single at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const f = await fixture(page);
    await page.goto('/admin?tab=orders');
    const card = page.locator('.admin-order-card').first();
    await expect(card).toContainText('Validation requise avant Olivraison'); await expect(card).toContainText('Confirmée sur le site');
    await expect(card).toContainText('5 ancienne(s)'); expect(f.writes).toEqual([]);
    await expect(card.getByRole('button', { name: 'Marquer expédiée' })).toHaveCount(0);
    await card.screenshot({ path: info.outputPath('manual-review.png') });
    await card.getByRole('button', { name: /Voir les détails/ }).click();
    const dialog = page.getByRole('dialog'); const button = dialog.getByRole('button', { name: 'Autoriser l’envoi à Olivraison' });
    page.once('dialog', d => d.dismiss()); await button.click(); expect(f.writes).toEqual([]);
    page.once('dialog', d => { expect(d.message()).toContain('#DEADBEEF'); return d.accept(); });
    await button.click(); await expect(button).toBeDisabled();
    await expect(dialog).toContainText('Envoi autorisé manuellement');
    await expect(dialog).toContainText('En attente de paiement'); await expect(button).toHaveCount(0);
    expect(f.writes).toEqual([`/api/orders/${id}/olivraison-approve`]);
    await dialog.screenshot({ path: info.outputPath('approved.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('An uncertain approval requires a fresh read before retry, without replaying automatically', async ({ page }) => {
    const f = await fixture(page, { fail: true }); await page.goto('/admin?tab=orders');
    const button = page.getByRole('button', { name: 'Autoriser l’envoi à Olivraison' }).first();
    page.once('dialog', d => d.accept()); await button.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Validation ou actualisation non confirmée' })).toBeVisible();
    await expect(button).toBeDisabled(); expect(f.writes).toHaveLength(1);
});
test('Read-only collaborators cannot authorize carrier dispatch', async ({ page }) => {
    await fixture(page, { reader: true }); await page.goto('/admin?tab=orders');
    await expect(page.locator('.admin-order-card')).toContainText('Validation requise avant Olivraison');
    await expect(page.getByRole('button', { name: 'Autoriser l’envoi à Olivraison' })).toHaveCount(0);
});
test('A parcel already at the carrier is never offered a new dispatch approval', async ({ page }) => {
    const f = await fixture(page, { tracking: true }); await page.goto('/admin?tab=orders');
    await expect(page.locator('.admin-order-card')).toContainText('TEST-EXISTING');
    await expect(page.getByRole('button', { name: 'Autoriser l’envoi à Olivraison' })).toHaveCount(0); expect(f.writes).toEqual([]);
});
test('Arabic mobile review and approval are translated and do not overflow', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 }); const f = await fixture(page, { ar: true });
    await page.goto('/admin?tab=orders');
    await expect(page.locator('.admin-order-card')).toContainText('الموافقة مطلوبة قبل الإرسال إلى Olivraison');
    await expect(page.getByRole('button', { name: 'السماح بالإرسال إلى Olivraison' })).toBeVisible();
    await page.locator('.admin-order-card').screenshot({ path: info.outputPath('manual-review-ar.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(f.writes).toEqual([]);
});
