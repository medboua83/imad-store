import { test, expect, type Page } from "@playwright/test";
const ownerId = '123456789012345678901234';
const fakeToken = (role = 'ADMIN', permissions: string[] = []) => 'fixture.' + Buffer.from(JSON.stringify({ id: ownerId, role, permissions })).toString('base64url') + '.fixture';
async function fixture(page: Page, role = 'ADMIN', permissions: string[] = [], locale = 'fr') {
    const calls: { method: string; path: string; body: any }[] = [];
    const cfg = { gmailUser: 'owner@example.invalid', enabled: false, host: 'smtp.gmail.com', port: 465, hasPassword: false, revision: 0 };
    const state = { failSave: false, delay: 0, creates: 0 };
    const users = [{ id: ownerId, email: 'owner@example.invalid', firstName: 'Owner', lastName: 'Test', role: 'ADMIN', permissions: [], isActive: true, mustSetPassword: false, createdAt: '2026-11-22T10:00:00Z' }];
    await page.addInitScript(({ token, locale }) => { localStorage.setItem('adminToken', token); localStorage.setItem('imad-admin-language', locale); }, { token: fakeToken(role, permissions), locale });
    await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()), method = req.method();
        const body = method === 'GET' ? null : req.postDataJSON(); calls.push({ method, path: url.pathname, body });
        if (url.pathname === '/api/team/gmail') {
            if (method === 'PUT') {
                if (state.delay) await new Promise(r => setTimeout(r, state.delay));
                if (state.failSave) return route.fulfill({ status: 400, json: { error: 'Votre mot de passe actuel est incorrect.' } });
                Object.assign(cfg, { gmailUser: body.gmailUser, enabled: body.enabled, port: body.port, hasPassword: !!body.appPassword || cfg.hasPassword, revision: cfg.revision + 1 });
            }
            return route.fulfill({ json: { success: true, data: cfg } });
        }
        if (url.pathname === '/api/team/gmail/test') return route.fulfill({ json: { success: true, data: { connected: true, emailSent: false } } });
        if (url.pathname === '/api/team') {
            if (method === 'POST') {
                state.creates++; if (state.delay) await new Promise(r => setTimeout(r, state.delay));
                const user = { ...users[0], ...body, id: 'abcdefabcdefabcdefabcdef', mustSetPassword: true };
                users.push(user); return route.fulfill({ status: 201, json: { success: true, data: user, invitationQueued: true } });
            }
            return route.fulfill({ json: { success: true, data: users, total: users.length, page: 1, totalPages: 1, currentUserId: ownerId } });
        }
        if (url.pathname === '/api/orders') return route.fulfill({ json: { success: true, data: [{ id: 'abcdefabcdefabcdefabcdef', status: 'PENDING', paymentStatus: 'PENDING', paymentMethod: 'COD', customerName: 'Client fictif', customerPhone: '+212600000099', totalAmount: 230, shippingCost: 30, items: [], createdAt: '2026-11-22T10:00:00Z' }], total: 1, page: 1, totalPages: 1 } });
        if (url.pathname === '/api/notifications') return route.fulfill({ json: { success: true, data: [], unread: 0 } });
        return route.fulfill({ json: { success: true, data: [], total: 0, page: 1, totalPages: 0 } });
    });
    return { calls, cfg, state };
}

for (const width of [320,390,1440]) test(`Gmail SMTP can be configured with a masked secret and tested without sending email at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const f = await fixture(page);
    await page.goto('/admin?tab=mail');
    const panel = page.locator('#gmail-smtp-settings'); await expect(panel).toContainText('Gmail SMTP désactivé');
    await expect(panel.getByLabel('Adresse Gmail d’envoi')).toHaveValue('owner@example.invalid');
    await panel.getByLabel('Mot de passe d’application Google', { exact: true }).fill('abcdefghijklmnop');
    await panel.getByLabel('Activer l’envoi des e-mails').check();
    await panel.getByLabel('Votre mot de passe actuel pour confirmer').fill('Fictitious-current-password');
    f.state.delay = 200;
    await panel.getByRole('button', { name: 'Enregistrer Gmail SMTP', exact: true }).dblclick();
    await expect(panel.getByRole('status')).toContainText('Configuration Gmail enregistrée');
    expect(f.calls.filter(r => r.path === '/api/team/gmail' && r.method === 'PUT')).toHaveLength(1);
    await expect(panel.getByLabel('Mot de passe d’application Google', { exact: true })).toHaveValue('');
    await expect(panel.getByLabel('Votre mot de passe actuel pour confirmer')).toHaveValue('');
    await panel.getByRole('button', { name: 'Tester la connexion SMTP' }).click();
    await expect(panel.getByRole('status')).toContainText('Aucun e-mail envoyé');
    expect(f.calls.filter(r => r.method === 'POST').map(r => r.path)).toEqual(['/api/team/gmail/test']);
    await panel.screenshot({ path: info.outputPath('gmail-config.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('A failed SMTP save preserves the entered settings, requires fresh confirmation and does not log out the administrator', async ({ page }) => {
    const f = await fixture(page); f.state.failSave = true; await page.goto('/admin?tab=mail');
    const panel = page.locator('#gmail-smtp-settings');
    await panel.getByLabel('Adresse Gmail d’envoi').fill('new.sender@example.invalid');
    await panel.getByLabel('Connexion sécurisée').selectOption('587');
    await panel.getByLabel('Mot de passe d’application Google', { exact: true }).fill('abcdefghijklmnop');
    await panel.getByLabel('Votre mot de passe actuel pour confirmer').fill('wrong');
    await panel.getByRole('button', { name: 'Enregistrer Gmail SMTP', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('incorrect');
    await expect(panel.getByLabel('Adresse Gmail d’envoi')).toHaveValue('new.sender@example.invalid');
    await expect(panel.getByLabel('Connexion sécurisée')).toHaveValue('587');
    await expect(panel.getByLabel('Votre mot de passe actuel pour confirmer')).toHaveValue('');
    expect(await page.evaluate(() => localStorage.getItem('adminToken'))).not.toBeNull();
    await expect(panel.getByRole('button', { name: 'Tester la connexion SMTP' })).toBeDisabled();
});

for (const width of [390,1440]) test(`A read-only collaborator sees permitted order data and no write, export, SMTP or team controls at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); const f = await fixture(page, 'STAFF', ['orders.read']);
    await page.goto('/admin?tab=mail');
    await expect(page.getByRole('heading', { name: 'Commandes', exact: true })).toBeVisible();
    await expect(page.locator('.admin-order-card')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Confirmer', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exporter CSV', exact: true })).toHaveCount(0);
    await expect(page.locator('.order-maintenance')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'E-mails et SMTP', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Équipe et accès', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Produits', exact: true })).toHaveCount(0);
    expect(f.calls.some(r => ['/api/team/gmail','/api/team','/api/products/admin/catalog'].includes(r.path))).toBe(false);
    await page.screenshot({ path: info.outputPath('staff-read-only.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Creating a collaborator queues one invitation, keeps explicit permissions and does not repeat the mutation when reloading', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 }); const f = await fixture(page); f.state.delay = 200;
    await page.goto('/admin?tab=team');
    await page.getByLabel('Prénom', { exact: true }).fill('Collaborateur');
    await page.getByLabel('Nom', { exact: true }).fill('Fictif');
    await page.getByLabel('Adresse e-mail', { exact: true }).fill('new@example.invalid');
    await page.getByLabel('Gérer les statuts et la corbeille des commandes').check();
    await page.getByLabel('Votre mot de passe actuel pour confirmer').fill('Fictitious-current-password');
    await page.getByRole('button', { name: 'Créer et inviter', exact: true }).dblclick();
    await expect(page.getByRole('status')).toContainText('Invitation préparée');
    expect(f.state.creates).toBe(1);
    expect(f.calls.find(r => r.method === 'POST')?.body.permissions.sort()).toEqual(['orders.read','orders.write']);
    await expect(page.locator('.team-user-list')).toContainText('Invitation en attente');
    await page.getByRole('button', { name: 'Recharger l’équipe', exact: true }).click();
    expect(f.state.creates).toBe(1);
    await page.screenshot({ path: info.outputPath('team-mobile.png') });
});

test('The reset secret stays out of HTTP URLs, matching passwords are required and only one reset is submitted', async ({ page }) => {
    const calls: string[] = [], token = 'A'.repeat(43);
    await page.route('**/api/auth/reset-password', async route => { calls.push(route.request().url()); await new Promise(r => setTimeout(r, 200)); await route.fulfill({ json: { success: true } }); });
    await page.goto('/admin/password#token=' + token);
    await expect(page.getByRole('heading', { name: 'Définir mon mot de passe', exact: true })).toBeVisible();
    expect(page.url()).not.toContain(token);
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('Fictitious-reset-password');
    await page.getByLabel('Confirmer le nouveau mot de passe').fill('Different-reset-password');
    await page.getByRole('button', { name: 'Enregistrer mon mot de passe', exact: true }).click();
    await expect(page.locator('.admin-recovery').getByRole('alert')).toContainText('identiques'); expect(calls).toHaveLength(0);
    await page.getByLabel('Confirmer le nouveau mot de passe').fill('Fictitious-reset-password');
    await page.getByRole('button', { name: 'Enregistrer mon mot de passe', exact: true }).dblclick();
    await expect(page.getByRole('status')).toContainText('Mot de passe enregistré');
    expect(calls).toHaveLength(1); expect(calls[0]).not.toContain(token);
});

test('Arabic SMTP settings remain readable on mobile with masked credentials', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 900 }); await fixture(page, 'ADMIN', [], 'ar');
    await page.goto('/admin?tab=mail');
    await expect(page.locator('#gmail-smtp-settings').getByRole('heading')).toContainText('Gmail SMTP');
    await expect(page.getByLabel('كلمة مرور التطبيق من Google', { exact: true })).toHaveAttribute('type','password');
    await page.screenshot({ path: info.outputPath('gmail-arabic-mobile.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Changing accounts in another tab clears the previous private data and replaces its permissions', async ({ page }) => {
    const f = await fixture(page);
    await page.goto('/admin?tab=orders');
    await expect(page.locator('.admin-order-card')).toContainText('Client fictif');
    const previousCalls = f.calls.length;
    await page.evaluate(token => {
        const oldValue = localStorage.getItem('adminToken'); localStorage.setItem('adminToken', token);
        window.dispatchEvent(new StorageEvent('storage', { key: 'adminToken', oldValue, newValue: token, storageArea: localStorage }));
    }, fakeToken('STAFF', ['catalogue.manage']));
    await expect(page.getByRole('heading', { name: 'Produits', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Client fictif');
    await expect(page.getByRole('button', { name: 'Commandes', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'E-mails et SMTP', exact: true })).toHaveCount(0);
    expect(f.calls.slice(previousCalls).some(r => r.path === '/api/orders')).toBe(false);
});
