import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { productColorKey } from '@imad-store/shared';
const { databaseUrl, createDatabase, dropDatabase } = require('../scripts/test-postgres.cjs');
const { createProfile } = require('../scripts/create-company-store.cjs');
const { loadProfile } = require('../scripts/run-company-store.cjs');

// A real, separate PostgreSQL login catches grants missing from fresh installers.
// Never load a merchant profile: the helper accepts only the disposable local test host.
const suffix = randomBytes(8).toString('hex'), db = 'imad_ci_' + suffix, role = 'imad_delivery_' + suffix;
const ownerUrl = new URL(databaseUrl(db)); ownerUrl.pathname = '/postgres';
const supervisor = new PrismaClient({ datasources: { db: { url: ownerUrl.toString() } } });
const pwd = 'Fictitious-installation-password-2026', staffPwd = 'Fictitious-cashier-password-2026';
const origin = 'https://atelier.example.invalid';
const mode = { Origin: origin, 'X-Imad-Admin-Session': 'cookie' };
const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
let directory: string | undefined, created = false, roleCreated = false, p: any, app: any, owner: any, product: any, order: any;
let connection: { headers: Record<string, string>; cookies: string[] };
let externalCalls = 0;
const originalFetch = globalThis.fetch;
const cookies = (r: any): string[] => r.headers['set-cookie'].map((s: string) => s.split(';')[0]);
const privateRequest = (method: 'get' | 'post' | 'put' | 'patch', path: string, session = connection) =>
    request(app)[method](path).set(session.headers).set('Cookie', session.cookies);
async function login(email = 'owner@example.invalid', password = pwd, code?: string) {
    const r = await request(app).post('/api/auth/login').set(mode).send({ email, password, ...(code ? { code } : {}) }).expect(200);
    assert.equal(r.body.data.mode, 'cookie');
    assert.deepEqual(Object.keys(r.body.data).sort(), ['identity', 'mode']);
    assert(r.headers['set-cookie'].every((s: string) => s.startsWith('__Host-imad_admin_') && s.includes('Secure') && s.includes('HttpOnly') && s.includes('SameSite=Strict')));
    return { headers: { ...mode, 'X-Imad-Admin-Identity': r.body.data.identity.id + ':' + r.body.data.identity.authVersion }, cookies: cookies(r) };
}
const stock = async (id: string) => (await p.productVariant.findUniqueOrThrow({ where: { id } })).stock;
const commerce = async () => json({ orders: await p.order.findMany({ orderBy: { id: 'asc' } }), variants: await p.productVariant.findMany({ orderBy: { id: 'asc' } }),
    shipments: await p.olivraisonShipment.findMany(), outbox: await p.deskcommOutbox.findMany(), sales: await p.posSale.findMany(), adjustments: await p.posAdjustment.findMany(), closing: await p.posCashClosing.findMany() });

before(async () => {
    await createDatabase(db); created = true;
    const secret = randomBytes(24).toString('hex');
    await supervisor.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`); roleCreated = true;
    const migration = new URL(databaseUrl(db));
    const grants = spawnSync('psql', ['-Xq', '--dbname=' + db, '-v', 'app_role=' + role, '-f', 'scripts/runtime-permissions.sql'], {
        env: { ...process.env, PGHOST: migration.hostname, PGPORT: migration.port || '5432', PGUSER: decodeURIComponent(migration.username), PGPASSWORD: decodeURIComponent(migration.password) }, encoding: 'utf8',
    });
    assert.equal(grants.status, 0, 'Fresh runtime permissions must apply to the empty disposable database');
    directory = await mkdtemp(join(tmpdir(), 'imad-delivery-'));
    const privateDir = join(directory, 'profile');
    createProfile({ name: 'Atelier Démonstration', origin, output: privateDir });
    const file = join(privateDir, 'store.env'), url = new URL(databaseUrl(db)); url.username = role; url.password = secret;
    await writeFile(file, (await readFile(file, 'utf8')).replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL=' + JSON.stringify(url.toString())), { mode: 0o600 });
    const profile = loadProfile(file);
    Object.assign(process.env, profile.vars, { IMAD_AUTH_MAIL_WORKER_DISABLED: 'true', INTEGRATION_TEST_MODE: 'true' });
    delete process.env.CRM_COMPANY_ID;
    const bootstrap = spawnSync(process.execPath, ['scripts/run-company-store.cjs', file, 'admin'], {
        env: { ...profile.env, BOOTSTRAP_ADMIN_EMAIL: 'owner@example.invalid', BOOTSTRAP_ADMIN_PASSWORD: pwd }, encoding: 'utf8',
    });
    assert.equal(bootstrap.status, 0, 'Bootstrap must work with the application role, not the migration owner');
    assert.doesNotMatch(bootstrap.stdout + bootstrap.stderr, new RegExp(secret + '|' + pwd));
    globalThis.fetch = (async () => { externalCalls++; throw new Error('External services forbidden in delivery acceptance'); }) as typeof fetch;
    ({ prisma: p } = await import('../backend/src/lib/prisma')); ({ app } = await import('../backend/src/app'));
    owner = await p.user.findUniqueOrThrow({ where: { email: 'owner@example.invalid' } }); connection = await login();
});
after(async () => {
    globalThis.fetch = originalFetch;
    try { await p?.$disconnect(); }
    finally {
        try { if (created) await dropDatabase(db); }
        finally {
            try { if (roleCreated) await supervisor.$executeRawUnsafe(`DROP ROLE "${role}"`); }
            finally { await supervisor.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); }
        }
    }
    assert.equal(externalCalls, 0);
});

test('Fresh application role serves public health and private readiness without inherited merchant data or a CRM', async () => {
    assert.equal((await p.$queryRaw`SELECT current_user AS role`)[0].role, role);
    await request(app).get('/health').expect(200);
    const operational = (await request(app).get('/api/operations/health').expect(200)).body;
    assert.equal(operational.hasFailedSends, false); assert.equal(operational.backupFresh, false);
    const ready = (await privateRequest('get', '/api/settings/readiness').expect(200)).body.data;
    assert.equal(ready.installationMode, 'standalone'); assert.equal(ready.emailDeliveryVerified, false);
    const settings = (await request(app).get('/api/settings').expect(200)).body.data;
    assert.equal(settings.branding.name, 'Atelier Démonstration'); assert.equal(settings.metaPixelEnabled, false); assert.equal(settings.metaPixelId, null);
    for (const key of ['whatsappPhone', 'whatsappUrl', 'instagramUrl', 'facebookUrl', 'tiktokUrl']) assert.equal(settings[key], '');
    for (const model of ['product', 'category', 'order', 'posSale', 'olivraisonShipment', 'deskcommConnection', 'deskcommOutbox', 'gmailConfig', 'carrierIncidentClosure']) assert.equal(await p[model].count(), 0, model);
    await privateRequest('put', '/api/integrations/deskcomm').send({ enabled: true }).expect(409);
});

test('Runtime grants cover migrated application tables and keep migrations, schema and immutable ledgers protected', async () => {
    const tables = await p.$queryRaw`SELECT tablename,has_table_privilege(current_user,quote_ident(schemaname)||'.'||quote_ident(tablename),'SELECT') AS readable,has_table_privilege(current_user,quote_ident(schemaname)||'.'||quote_ident(tablename),'TRUNCATE') AS truncatable FROM pg_tables WHERE schemaname='public'`;
    assert(tables.length >= 30);
    for (const table of tables) { assert.equal(table.readable, table.tablename !== '_prisma_migrations', table.tablename); assert.equal(table.truncatable, false, table.tablename); }
    for (const table of ['carrier_incident_closures', 'pos_sales', 'pos_sale_items', 'pos_adjustments', 'pos_adjustment_items', 'pos_cash_closings', 'pos_cash_sessions']) {
        const [privilege] = await p.$queryRawUnsafe(`SELECT has_table_privilege(current_user,'${table}','INSERT') AS append,has_table_privilege(current_user,'${table}','UPDATE') AS edit,has_table_privilege(current_user,'${table}','DELETE') AS remove`);
        assert.deepEqual(privilege, { append: true, edit: false, remove: false });
    }
    await assert.rejects(p.$executeRawUnsafe('CREATE TABLE public.forbidden_delivery_table (id int)'));
    await assert.rejects(p.$executeRawUnsafe('DELETE FROM carrier_incident_closures'));
});

test('An independently bootstrapped owner publishes photo/color variants and a repeated order cancels without changing payment', async () => {
    const category = await p.category.create({ data: { slug: 'demonstration', nameFr: 'Démonstration', nameAr: 'تجربة', nameEn: 'Demo' } });
    const variants = [{ color: '#000000', colorNameFr: 'Noir', colorNameAr: 'أسود', colorNameEn: 'Black', stock: 5, size: 'M', sku: 'DEMO-NOIR-M' },
        { color: '#d0b890', colorNameFr: 'Beige', colorNameAr: 'بيج', colorNameEn: 'Beige', stock: 5, size: 'M', sku: 'DEMO-BEIGE-M' }];
    const images = ['/images/cat-abayas.png', '/images/cat-coats.png'];
    product = (await privateRequest('post', '/api/products').send({ slug: 'article-fictif', nameFr: 'Article fictif', nameAr: 'منتج تجريبي', nameEn: 'Fictitious item', descriptionFr: '', descriptionAr: '', descriptionEn: '', price: 100, categoryId: category.id, status: 'ACTIVE', images, variants,
        colorPhotos: variants.map((v, i) => ({ colorKey: productColorKey(v), image: images[i] })) }).expect(201)).body.data;
    const published = (await request(app).get('/api/products/article-fictif').expect(200)).body.data;
    assert.deepEqual(published.colorPhotos, variants.map((v, i) => ({ colorKey: productColorKey(v), image: images[i] })));
    const key = randomUUID(), body = { confirmationMode: 'SITE', paymentMethod: 'COD', customer: { fullName: 'Client fictif', phone: '+212600000099', street: 'Adresse fictive', city: 'Casablanca', region: 'Casablanca' },
        items: [{ productId: product.id, variantId: product.variants[0].id, quantity: 2, price: 0.01 }] };
    const submit = () => request(app).post('/api/orders').set('Idempotency-Key', key).send(body);
    order = (await submit().expect(201)).body.data; assert.equal((await submit().expect(200)).body.data.id, order.id);
    assert.equal(await p.order.count(), 1); assert.equal(await stock(product.variants[0].id), 3);
    const before = await p.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(before.totalAmount - before.shippingCost, 200); assert.equal(before.paymentStatus, 'PENDING');
    await privateRequest('patch', '/api/orders/' + order.id + '/status').send({ status: 'CANCELLED' }).expect(200);
    const after = await p.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(after.paymentStatus, before.paymentStatus); assert.equal(after.totalAmount, before.totalAmount);
    assert.equal(await stock(product.variants[0].id), 5); assert.equal(await p.deskcommOutbox.count(), 0); assert.equal(await p.olivraisonShipment.count(), 0);
});

test('Real runtime permissions support a deduplicated sale, exchange, non-resellable refund and immutable cash closing', async () => {
    const sid = (await privateRequest('post', '/api/pos/cash-sessions/open').set('Idempotency-Key', 'open_' + randomUUID()).send({ openingCents: 10000 }).expect(201)).body.data.id;
    const items = [{ variantId: product.variants[0].id, quantity: 1 }];
    const quote = (await privateRequest('post', '/api/pos/quote').send({ items }).expect(200)).body.data;
    const key = randomUUID(), body = { items, quoteHash: quote.quoteHash, paymentMethod: 'CASH', receivedCents: 20000, cashSessionId: sid };
    const submit = () => privateRequest('post', '/api/pos/sales').set('Idempotency-Key', key).send(body);
    const receipt = (await submit().expect(201)).body.data;
    assert.equal((await submit().expect(200)).body.data.id, receipt.id); assert.equal(await p.posSale.count(), 1);
    assert.equal(await stock(product.variants[0].id), 4);
    async function adjust(sourceKind: string, sourceId: string, itemId: string, restock: boolean, replacements: unknown[]) {
        const data = { sourceKind, sourceId, returns: [{ itemId, quantity: 1, restock }], replacements };
        const q = (await privateRequest('post', '/api/pos/returns/quote').send(data).expect(200)).body.data;
        const key = randomUUID(), b = { ...data, quoteHash: q.quoteHash, cashSessionId: sid, paymentMethod: q.netCents === 0 ? 'NONE' : 'CASH', receivedCents: Math.max(0, q.netCents), note: 'Recette fictive isolée' };
        const post = () => privateRequest('post', '/api/pos/returns').set('Idempotency-Key', key).send(b);
        const r = (await post().expect(201)).body.data; assert.equal((await post().expect(200)).body.data.id, r.id); return r;
    }
    const exchange = await adjust('SALE', receipt.id, receipt.items[0].id, true, [{ variantId: product.variants[1].id, quantity: 1 }]);
    assert.equal(exchange.netCents, 0); assert.equal(await stock(product.variants[0].id), 5); assert.equal(await stock(product.variants[1].id), 4);
    const refund = await adjust('EXCHANGE', exchange.id, exchange.items.find((i: any) => i.kind === 'REPLACEMENT').id, false, []);
    assert.equal(refund.netCents, -10000); assert.equal(await stock(product.variants[1].id), 4);
    const active = (await privateRequest('get', '/api/pos/cash-sessions/context').expect(200)).body.data.active;
    assert.equal(active.expectedCents, 10000);
    const closeKey = 'close_' + randomUUID(), closeBody = { sessionId: sid, balanceHash: active.balanceHash, countedCents: 10000, note: '' };
    const close = () => privateRequest('post', '/api/pos/cash-sessions/close').set('Idempotency-Key', closeKey).send(closeBody);
    await close().expect(201); await close().expect(200); assert.equal(await p.posCashClosing.count(), 1);
    assert.equal((await p.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, 'PENDING');
});

test('Fresh audit-table permissions allow an incident closure once, preserve commerce and forbid historical edits', async () => {
    const shipment = await p.olivraisonShipment.create({ data: { id: order.id, state: 'ATTENTION', trackingId: 'FICTITIOUS-DELIVERY-ONLY', carrierStatus: 'RETURNED', lastError: 'Contrôle fictif de retour' } });
    const { carrierIncidentFingerprint } = await import('../backend/src/lib/carrier-incident-closure');
    const baseline = await commerce(), body = { fingerprint: carrierIncidentFingerprint(shipment), reason: 'Recette sur une boutique fictive, sans validation de retour physique.' };
    const close = () => privateRequest('post', '/api/orders/' + order.id + '/carrier-incident-close').send(body);
    const a = await close().expect(200), b = await close().expect(200);
    assert.equal(a.body.data.created, true); assert.equal(b.body.data.created, false); assert.equal(await p.carrierIncidentClosure.count(), 1);
    assert.equal(await commerce(), baseline);
    await privateRequest('get', '/api/orders/' + order.id + '/carrier-incident-history').expect(200);
    assert.equal((await request(app).get('/api/operations/health').expect(200)).body.hasFailedSends, false);
    await assert.rejects(p.carrierIncidentClosure.updateMany({ data: { reason: 'Modification interdite du motif historique.' } }));
    assert.equal(await p.carrierIncidentClosure.count(), 1);
});

test('Invitation, password reset and MFA recovery run under the runtime role with a simulated mailbox and minimum staff access', async () => {
    const baseline = await commerce();
    await privateRequest('put', '/api/team/gmail').send({ enabled: true, gmailUser: 'smtp@example.invalid', port: 465, appPassword: 'abcdefghijklmnop', revision: 0, currentPassword: pwd }).expect(200);
    const invited = (await privateRequest('post', '/api/team').send({ email: 'reader@example.invalid', firstName: 'Fictif', lastName: 'Lecteur', role: 'STAFF', permissions: ['orders.read'], currentPassword: pwd }).expect(201)).body.data;
    const { processAccessMail } = await import('../backend/src/lib/password-reset');
    const delivered: { address: string; token: string; kind: string }[] = [];
    const simulatedMailbox = async (address: string, token: string, kind: string) => { assert.equal(address, 'reader@example.invalid'); delivered.push({ address, token, kind }); };
    await Promise.all([processAccessMail(simulatedMailbox), processAccessMail(simulatedMailbox)]);
    assert.equal(delivered.length, 1); assert.equal(delivered[0].kind, 'INVITE');
    const reset = (token: string, password: string) => request(app).post('/api/auth/reset-password').send({ token, password });
    await reset(delivered[0].token, staffPwd).expect(200); await reset(delivered[0].token, staffPwd).expect(400);
    const staff = await login('reader@example.invalid', staffPwd);
    await privateRequest('get', '/api/orders', staff).expect(200);
    for (const path of ['/api/team', '/api/settings/readiness', '/api/pos/context']) await privateRequest('get', path, staff).expect(403);
    const setup = (await privateRequest('post', '/api/auth/mfa/setup', staff).send({ currentPassword: staffPwd }).expect(200)).body.data;
    const { mfaTotp } = await import('../backend/src/lib/admin-mfa');
    await privateRequest('post', '/api/auth/mfa/confirm', staff).send({ currentPassword: staffPwd, setupId: setup.setupId, recoverySaved: true, code: mfaTotp(setup.secret).generate() }).expect(200);
    await privateRequest('get', '/api/orders', staff).expect(401);
    await request(app).post('/api/auth/forgot-password').send({ email: 'reader@example.invalid' }).expect(202);
    await processAccessMail(simulatedMailbox); assert.equal(delivered.length, 2); assert.equal(delivered[1].kind, 'RESET');
    const changed = 'Fictitious-recovered-password-2026'; await reset(delivered[1].token, changed).expect(200); await reset(delivered[1].token, changed).expect(400);
    assert((await p.adminMfa.findUniqueOrThrow({ where: { userId: invited.id } })).enabledAt);
    const after = await login('reader@example.invalid', changed, setup.recoveryCodes[0]);
    await privateRequest('get', '/api/orders', after).expect(200);
    await request(app).post('/api/auth/mfa/recover').set(mode).send({ email: 'reader@example.invalid', password: changed, code: setup.recoveryCodes[1] }).expect(200);
    await privateRequest('get', '/api/orders', after).expect(401);
    assert.equal((await p.adminMfa.findUniqueOrThrow({ where: { userId: invited.id } })).enabledAt, null);
    assert.equal(await commerce(), baseline); assert.equal(externalCalls, 0);
    assert.equal((await privateRequest('get', '/api/settings/readiness').expect(200)).body.data.emailDeliveryVerified, false);
});
