import { test, expect, type BrowserContext, type Page } from '@playwright/test';
const identity = { id: 'a'.repeat(24), role: 'ADMIN', authVersion: 0, permissions: [] };
const current = { id: 'c'.repeat(24), createdAt: '2026-11-26T10:00:00Z', expiresAt: '2026-12-03T10:00:00Z' };
const others = ['d', 'e', 'f'].map((letter, i) => ({ id: letter.repeat(24), createdAt: `2026-11-25T1${i}:00:00Z`, expiresAt: '2026-12-02T10:00:00Z' }));
const labels = {
    fr: { see: 'Voir mes sessions', refresh: 'Actualiser mes sessions', close: 'Fermer mes autres sessions', submit: 'Confirmer la déconnexion', password: 'Mot de passe actuel (sessions)', code: 'Code de l’application ou code de secours (sessions)', current: 'Session actuelle — conservée', empty: 'Aucune autre session active.', next: 'Voir les sessions suivantes' },
    ar: { see: 'عرض جلساتي', refresh: 'تحديث جلساتي', close: 'إغلاق جلساتي الأخرى', submit: 'تأكيد إغلاق الجلسات', password: 'كلمة المرور الحالية (الجلسات)', code: 'رمز التطبيق أو الرمز الاحتياطي (الجلسات)', current: 'الجلسة الحالية — تبقى مفتوحة', empty: 'لا توجد جلسة أخرى نشطة.', next: 'عرض الجلسات التالية' },
};
async function fixture(context: BrowserContext, staff = false) {
    const state = { reads: 0, writes: [] as { path: string; body: any }[], unknownWrites: [] as string[], active: true,
        badRead: false, badBody: false, lostReply: false, rejection: '', mfa: true, alternateCurrent: false, emptyFirstPage: false,
        release: null as null | (() => void), gated: false };
    await context.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        if (path === '/api/auth/session' || path === '/api/auth/refresh')
            return route.fulfill({ json: { success: true, data: { mode: 'cookie', identity: staff ? { ...identity, role: 'STAFF' } : identity } } });
        if (path === '/api/auth/mfa') return route.fulfill({ json: { success: true, data: { enabled: state.mfa, enabledAt: state.mfa ? '2026-11-25T12:00:00Z' : null, recoveryCodesRemaining: state.mfa ? 8 : 0 } } });
        if (path === '/api/auth/sessions' && request.method() === 'GET') {
            state.reads++;
            if (state.badRead) return route.fulfill({ status: 503, json: { success: false } });
            const before = url.searchParams.get('before');
            const page = !state.active ? [] : state.emptyFirstPage && !before ? [] : before ? others.slice(2) : others.slice(0, 2);
            const data = { current: state.alternateCurrent && before ? { ...current, id: '9'.repeat(24) } : current,
                others: page, nextCursor: state.active && !before ? others[1].id : null, mfaEnabled: state.mfa };
            if (state.badBody) delete (data as Partial<typeof data>).mfaEnabled;
            return route.fulfill({ json: { success: true, data } });
        }
        if (request.method() !== 'GET') {
            const body = request.postDataJSON(); state.writes.push({ path, body });
            if (path !== '/api/auth/sessions/close-others') { state.unknownWrites.push(path); return route.fulfill({ status: 405 }); }
            if (state.gated) await new Promise<void>(resolve => { state.release = resolve; });
            if (state.rejection) return route.fulfill({ status: 400, json: { success: false, error: state.rejection } });
            state.active = false;
            if (state.lostReply) return route.abort('failed');
            return route.fulfill({ json: { success: true, data: { closed: 3, currentSessionKept: true } } });
        }
        return route.fulfill({ json: { success: true, data: path === '/api/settings' ? { shippingCost: 30, metaPixelEnabled: false, codEnabled: true } : [], total: 0, totalPages: 1, unread: 0 } });
    });
    return state;
}
async function start(page: Page, locale: 'fr' | 'ar' = 'fr') {
    await page.goto('/admin?tab=account'); await expect(page.locator('.admin-sessions')).toBeVisible();
    if (locale === 'ar') await page.getByRole('combobox', { name: 'Langue de l’administration / لغة لوحة الإدارة' }).selectOption('ar');
    return page.locator('.admin-sessions');
}
test.afterEach(async ({ context }) => context.unrouteAll({ behavior: 'ignoreErrors' }));

for (const width of [320, 390, 1440]) for (const locale of ['fr', 'ar'] as const)
    test(`Personal sessions, pagination and explicit password/MFA confirmation at ${width}px ${locale}`, async ({ page, context }, info) => {
        await page.setViewportSize({ width, height: 1000 }); const state = await fixture(context), l = labels[locale], panel = await start(page, locale);
        expect(state.reads).toBe(0); expect(state.writes).toEqual([]);
        await panel.getByRole('button', { name: l.see, exact: true }).click(); await expect(panel.getByText(l.current, { exact: true })).toBeVisible();
        await expect(panel.locator('.admin-session-list li')).toHaveCount(2); await panel.getByRole('button', { name: l.next, exact: true }).click(); await expect(panel.locator('.admin-session-list li')).toHaveCount(3);
        await panel.getByRole('button', { name: l.close, exact: true }).click(); const pass = panel.getByLabel(l.password, { exact: true }), code = panel.getByLabel(l.code, { exact: true }), submit = panel.getByRole('button', { name: l.submit, exact: true });
        await expect(pass).toBeFocused(); await expect(submit).toBeDisabled(); await pass.fill('Fixture-Password'); await expect(submit).toBeDisabled(); await code.fill('123456');
        await page.screenshot({ path: info.outputPath(`sessions-${locale}-${width}.png`), fullPage: true });
        state.gated = true; await submit.dblclick(); await expect.poll(() => state.writes.length).toBe(1); await expect(submit).toBeDisabled(); state.release!();
        await expect(panel.getByText(l.empty, { exact: true })).toBeVisible(); await expect(panel.getByText(l.current, { exact: true })).toBeVisible();
        await expect(panel.getByLabel(l.password, { exact: true })).toHaveCount(0); await expect(page.locator('.admin-workspace')).toBeVisible();
        expect(state.writes).toEqual([{ path: '/api/auth/sessions/close-others', body: { currentPassword: 'Fixture-Password', code: '123456' } }]); expect(state.unknownWrites).toEqual([]);
        const storage = await page.evaluate(() => Object.values(localStorage).join('')); expect(storage).not.toContain('Fixture-Password'); expect(storage).not.toContain('123456');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });

test('A collaborator without commercial permissions can read their own connections; cancellation sends nothing', async ({ page, context }) => {
    const state = await fixture(context, true), panel = await start(page); await panel.getByRole('button', { name: labels.fr.see, exact: true }).click();
    await panel.getByRole('button', { name: labels.fr.close, exact: true }).click(); await panel.getByLabel(labels.fr.password, { exact: true }).fill('Fixture-Password');
    await panel.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(state.writes).toEqual([]); await expect(panel.getByLabel(labels.fr.password, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Commandes', exact: true })).toHaveCount(0);
});

test('An uncertain response clears credentials, never retries automatically and requires a fresh read before another action', async ({ page, context }) => {
    const state = await fixture(context), panel = await start(page); state.lostReply = true;
    await panel.getByRole('button', { name: labels.fr.see, exact: true }).click(); await panel.getByRole('button', { name: labels.fr.close, exact: true }).click();
    await panel.getByLabel(labels.fr.password, { exact: true }).fill('Fixture-Password'); await panel.getByLabel(labels.fr.code, { exact: true }).fill('123456');
    await panel.getByRole('button', { name: labels.fr.submit, exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('Déconnexion non confirmée');
    await expect(panel.getByLabel(labels.fr.password, { exact: true })).toHaveValue(''); await expect(panel.getByLabel(labels.fr.code, { exact: true })).toHaveValue(''); await expect(panel.getByRole('button', { name: labels.fr.submit, exact: true })).toBeDisabled();
    expect(state.writes.length).toBe(1); await panel.getByRole('button', { name: labels.fr.refresh, exact: true }).click(); await expect(panel.getByText(labels.fr.empty, { exact: true })).toBeVisible(); expect(state.writes.length).toBe(1);
});

test('A rejected factor clears secrets and can be corrected without closing the current session', async ({ page, context }) => {
    const state = await fixture(context), panel = await start(page); state.rejection = 'Code incorrect, expiré ou déjà utilisé. Attendez le prochain code ou utilisez un code de secours.';
    await panel.getByRole('button', { name: labels.fr.see, exact: true }).click(); await panel.getByRole('button', { name: labels.fr.close, exact: true }).click();
    await panel.getByLabel(labels.fr.password, { exact: true }).fill('Fixture-Password'); await panel.getByLabel(labels.fr.code, { exact: true }).fill('bad'); await panel.getByRole('button', { name: labels.fr.submit, exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('Code incorrect'); await expect(panel.getByLabel(labels.fr.password, { exact: true })).toHaveValue(''); await expect(panel.getByLabel(labels.fr.code, { exact: true })).toHaveValue('');
    state.rejection = ''; await panel.getByLabel(labels.fr.password, { exact: true }).fill('Fixture-Password'); await panel.getByLabel(labels.fr.code, { exact: true }).fill('123456'); await panel.getByRole('button', { name: labels.fr.submit, exact: true }).click();
    await expect(panel.getByText(labels.fr.empty, { exact: true })).toBeVisible(); expect(state.writes.length).toBe(2); await expect(page.locator('.admin-workspace')).toBeVisible();
});

test('Missing MFA metadata is rejected instead of presenting an empty safe list; a failed refresh keeps the last read without enabling actions', async ({ page, context }) => {
    const state = await fixture(context), panel = await start(page); state.badBody = true;
    await panel.getByRole('button', { name: labels.fr.see, exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('Liste des sessions indisponible'); await expect(panel.getByText(labels.fr.empty, { exact: true })).toHaveCount(0); await expect(panel.getByRole('button', { name: labels.fr.close, exact: true })).toHaveCount(0);
    state.badBody = false; await panel.getByRole('button', { name: labels.fr.refresh, exact: true }).click(); await expect(panel.locator('.admin-session-list li')).toHaveCount(2);
    state.badRead = true; await panel.getByRole('button', { name: labels.fr.refresh, exact: true }).click(); await expect(panel.getByText('La liste affichée correspond à la dernière lecture réussie.', { exact: true })).toBeVisible(); await expect(panel.getByRole('button', { name: labels.fr.close, exact: true })).toBeDisabled(); expect(state.writes).toEqual([]);
});

test('An empty scan page still reaches additional sessions, while a changed current connection invalidates pagination', async ({ page, context }) => {
    const state = await fixture(context), panel = await start(page); state.emptyFirstPage = true;
    await panel.getByRole('button', { name: labels.fr.see, exact: true }).click(); await expect(panel.getByText('D’autres sessions restent à consulter.', { exact: true })).toBeVisible(); await expect(panel.getByText(labels.fr.empty, { exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: labels.fr.next, exact: true }).click(); await expect(panel.locator('.admin-session-list li')).toHaveCount(1);
    state.emptyFirstPage = false; await panel.getByRole('button', { name: labels.fr.refresh, exact: true }).click(); state.alternateCurrent = true; await panel.getByRole('button', { name: labels.fr.next, exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('Liste des sessions indisponible'); await expect(panel.getByRole('button', { name: labels.fr.close, exact: true })).toBeDisabled(); expect(state.writes).toEqual([]);
});

test('Accounts without MFA confirm only their password and retain their current connection', async ({ page, context }) => {
    const state = await fixture(context); state.mfa = false; const panel = await start(page);
    await panel.getByRole('button', { name: labels.fr.see, exact: true }).click(); await panel.getByRole('button', { name: labels.fr.close, exact: true }).click();
    await expect(panel.getByLabel(labels.fr.code, { exact: true })).toHaveCount(0); await panel.getByLabel(labels.fr.password, { exact: true }).fill('Fixture-Password'); await panel.getByRole('button', { name: labels.fr.submit, exact: true }).click();
    await expect(panel.getByText(labels.fr.empty, { exact: true })).toBeVisible(); expect(state.writes[0].body).toEqual({ currentPassword: 'Fixture-Password' }); await expect(panel.getByText(labels.fr.current, { exact: true })).toBeVisible();
});
