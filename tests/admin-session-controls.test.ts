import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
const { databaseUrl, createDatabase, dropDatabase } = require('../scripts/test-postgres.cjs');
const name = 'imad_ci_' + randomBytes(8).toString('hex');
process.env.DATABASE_URL = databaseUrl(name);
process.env.SITE_URL = 'http://localhost:3000';
process.env.IMAD_AUTH_MAIL_WORKER_DISABLED = 'true';
process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = 'false';
let p: any, app: any, hash: string, commerce: string, mfa: typeof import('../backend/src/lib/admin-mfa');
const pwd = 'Fictitious-session-controls-2026';
const originalFetch = globalThis.fetch; let externalCalls = 0, sequence = 0;
const ip = () => ({ 'X-Forwarded-For': '192.0.2.' + (++sequence % 250 + 1) });
const baseHeaders = { Origin: 'http://localhost:3000', 'X-Imad-Admin-Session': 'cookie' };
const headers = (u: any) => ({ ...baseHeaders, 'X-Imad-Admin-Identity': u.id + ':' + u.authVersion });
async function account(role = 'ADMIN') {
    return p.user.create({ data: { email: 'sessions-' + randomBytes(5).toString('hex') + '@example.invalid', firstName: 'FICTITIOUS', lastName: 'SESSION', role, permissions: [], passwordHash: hash } });
}
async function session(user: any, createdAt = new Date()) {
    const id = randomBytes(12).toString('hex');
    const token = jwt.sign({ id: user.id, sv: user.authVersion, sid: id }, process.env.JWT_REFRESH_SECRET!, { algorithm: 'HS256', jwtid: randomUUID(), expiresIn: '7d' });
    const access = jwt.sign({ id: user.id, role: user.role, sv: user.authVersion, sid: id }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '15m' });
    const row = await p.refreshToken.create({ data: { id, userId: user.id, token, createdAt, expiresAt: new Date((jwt.decode(token) as jwt.JwtPayload).exp! * 1000) } });
    return { user, row, access, cookie: ['imad_admin_access=' + access, 'imad_admin_refresh=' + token] };
}
const list = (s: any, before?: string) => request(app).get('/api/auth/sessions').query(before ? { before } : {}).set(ip()).set(headers(s.user)).set('Cookie', s.cookie);
const close = (s: any, body: any = {}, network = ip()) => request(app).post('/api/auth/sessions/close-others').set(network).set(headers(s.user)).set('Cookie', s.cookie).send({ currentPassword: pwd, ...body });
const snapshot = async () => JSON.stringify({
    orders: await p.order.findMany(), variants: await p.productVariant.findMany(), shipments: await p.olivraisonShipment.findMany(),
    outbox: await p.deskcommOutbox.findMany(), sales: await p.posSale.findMany(), adjustments: await p.posAdjustment.findMany(),
    registers: await p.posCashRegister.findMany(), cashSessions: await p.posCashSession.findMany(), closing: await p.posCashClosing.findMany(),
    settings: await p.storeSettings.findMany(), smtp: await p.gmailConfig.findMany(),
});
before(async () => {
    await createDatabase(name);
    globalThis.fetch = (async () => { externalCalls++; throw new Error('External calls forbidden in session tests'); }) as typeof fetch;
    ({ prisma: p } = await import('../backend/src/lib/prisma')); ({ app } = await import('../backend/src/app'));
    mfa = await import('../backend/src/lib/admin-mfa'); app.set('trust proxy', 1); hash = await bcrypt.hash(pwd, 10);
    await p.order.create({ data: { customerName: 'FICTITIOUS', customerPhone: '+212600000099', city: 'Fixture', totalAmount: 230, shippingCost: 30, status: 'PENDING', paymentStatus: 'PENDING', paymentMethod: 'COD', inventoryReserved: true } });
    commerce = await snapshot();
});
after(async () => { globalThis.fetch = originalFetch; if (p) { assert.equal(await snapshot(), commerce); await p.$disconnect(); } await dropDatabase(name); assert.equal(externalCalls, 0); });

test('Personal session pages are private, credential-free, complete and exclude another user, expired or legacy API access', async () => {
    const u = await account(), current = await session(u), someone = await account(), foreign = await session(someone);
    const sessions = [];
    for (let i = 0; i < 25; i++) sessions.push(await session(u, new Date(Date.now() - 1000 * (i + 1))));
    const expired = await session(u); await p.refreshToken.update({ where: { id: expired.row.id }, data: { expiresAt: new Date(0) } });
    const legacy = jwt.sign({ id: u.id, sv: u.authVersion }, process.env.JWT_REFRESH_SECRET!, { jwtid: randomUUID(), expiresIn: '7d' });
    await p.refreshToken.create({ data: { userId: u.id, token: legacy, expiresAt: new Date(Date.now() + 86400000) } });
    const first = await list(current).expect(200);
    assert.match(first.headers['cache-control'], /private, no-store/);
    assert.deepEqual(Object.keys(first.body.data).sort(), ['current', 'mfaEnabled', 'nextCursor', 'others']);
    assert.deepEqual(first.body.data.current, { id: current.row.id, createdAt: current.row.createdAt.toISOString(), expiresAt: current.row.expiresAt.toISOString() });
    assert.equal(first.body.data.others.length, 20); assert.equal(first.body.data.mfaEnabled, false);
    const next = (await list(current, first.body.data.nextCursor).expect(200)).body.data;
    assert.equal(next.others.length, 5); assert.equal(next.nextCursor, null);
    assert.deepEqual(new Set([...first.body.data.others, ...next.others].map(x => x.id)), new Set(sessions.map(x => x.row.id)));
    const json = JSON.stringify(first.body);
    for (const secret of [current.access, current.row.token, sessions[0].row.token, legacy, foreign.row.id, u.email, u.passwordHash]) assert.equal(json.includes(secret), false);
    for (const row of first.body.data.others) assert.deepEqual(Object.keys(row).sort(), ['createdAt', 'expiresAt', 'id']);
    await list(current, foreign.row.id).expect(409);
});

test('Closing other browser sessions revokes access immediately and preserves the exact current row, account and unrelated credentials', async () => {
    const u = await account(), current = await session(u), a = await session(u), b = await session(u), other = await session(await account());
    const legacyToken = jwt.sign({ id: u.id, sv: 0 }, process.env.JWT_REFRESH_SECRET!, { jwtid: randomUUID(), expiresIn: '7d' });
    const legacy = await p.refreshToken.create({ data: { userId: u.id, token: legacyToken, expiresAt: new Date(Date.now() + 86400000) } });
    const userBefore = await p.user.findUnique({ where: { id: u.id } });
    const result = await close(current).expect(200);
    assert.deepEqual(result.body.data, { closed: 2, currentSessionKept: true }); assert.equal(result.headers['set-cookie'], undefined);
    assert.deepEqual(await p.refreshToken.findUnique({ where: { id: current.row.id } }), current.row);
    assert.deepEqual(await p.user.findUnique({ where: { id: u.id } }), userBefore);
    assert.deepEqual(await p.refreshToken.findUnique({ where: { id: other.row.id } }), other.row);
    assert.deepEqual(await p.refreshToken.findUnique({ where: { id: legacy.id } }), legacy);
    await list(current).expect(200);
    await request(app).post('/api/auth/refresh').set(ip()).set(baseHeaders).set('Cookie', current.cookie).send({}).expect(200);
    for (const s of [a, b]) {
        await list(s).expect(401);
        await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + s.access).expect(401);
        await request(app).post('/api/auth/refresh').set(ip()).set(baseHeaders).set('Cookie', s.cookie).send({}).expect(401);
    }
    assert.equal(await p.accessEvent.count({ where: { actorId: u.id, action: 'OTHER_BROWSER_SESSIONS_CLOSED' } }), 1);
});

test('Missing authentication, bearer clients, foreign origins, changed browser identity and injected targets cannot revoke sessions', async () => {
    const current = await session(await account()), other = await session(current.user), before = await p.refreshToken.count();
    await request(app).get('/api/auth/sessions').expect(401);
    await request(app).post('/api/auth/sessions/close-others').send({ currentPassword: pwd }).expect(401);
    await request(app).get('/api/auth/sessions').set('Authorization', 'Bearer ' + current.access).expect(403);
    await request(app).post('/api/auth/sessions/close-others').set('Authorization', 'Bearer ' + current.access).send({ currentPassword: pwd }).expect(403);
    await request(app).get('/api/auth/sessions').set({ ...headers(current.user), Origin: 'https://sibling.example' }).set('Cookie', current.cookie).expect(403);
    await request(app).get('/api/auth/sessions').set(headers(current.user)).set('Cookie', [current.cookie[0]]).expect(401);
    await request(app).post('/api/auth/sessions/close-others').set(ip()).set(headers(current.user)).set('Cookie', [current.cookie[0], other.cookie[1]]).send({ currentPassword: pwd }).expect(401);
    await request(app).post('/api/auth/sessions/close-others').set(ip()).set({ ...headers(current.user), 'X-Imad-Admin-Identity': '0'.repeat(24) + ':0' }).set('Cookie', current.cookie).send({ currentPassword: pwd }).expect(409);
    await close(current, { userId: other.user.id }).expect(400);
    await close(current, { currentSession: other.row.id }).expect(400);
    await close(current, { currentPassword: 'incorrect' }).expect(400);
    assert.equal(await p.refreshToken.count(), before);
});

test('A collaborator without commercial permissions can manage only their own sessions, not a customer account', async () => {
    const current = await session(await account('STAFF')), other = await session(current.user), owner = await session(await account());
    await list(current).expect(200); await close(current).expect(200);
    assert.equal(await p.refreshToken.findUnique({ where: { id: other.row.id } }), null);
    assert.deepEqual(await p.refreshToken.findUnique({ where: { id: owner.row.id } }), owner.row);
    const customer = await session(await account('CUSTOMER'));
    await list(customer).expect(403); await close(customer).expect(403);
});

async function enabled() {
    const u = await account(), secret = mfa.generateMfaSecret(), codes = ['FICT-1111-2222-3333', 'FICT-4444-5555-6666'];
    await p.adminMfa.create({ data: { userId: u.id, secretCiphertext: mfa.sealMfaSecret(u.id, secret), enabledAt: new Date(), recoveryHashes: codes.map(c => mfa.recoveryHash(u.id, c)) } });
    return { current: await session(u), secret, codes };
}
test('MFA is required, consumed once and cannot be bypassed by reusing the same code', async () => {
    const { current, secret } = await enabled(), other = await session(current.user);
    await close(current).expect(400); await close(current, { code: 'not-a-valid-code' }).expect(400);
    assert(await p.refreshToken.findUnique({ where: { id: other.row.id } }));
    const token = mfa.mfaTotp(secret).generate(); await close(current, { code: token }).expect(200);
    assert.equal(await p.refreshToken.findUnique({ where: { id: other.row.id } }), null);
    const later = await session(current.user); await close(current, { code: token }).expect(400);
    assert(await p.refreshToken.findUnique({ where: { id: later.row.id } })); await list(current).expect(200);
    assert.deepEqual(await p.refreshToken.findUnique({ where: { id: current.row.id } }), current.row);
});

test('The MFA failure counter survives rejected requests and locks across distinct request addresses', async () => {
    const { current } = await enabled(), other = await session(current.user);
    for (let n = 0; n < 4; n++) await close(current, { code: 'invalid-backup' }).expect(400);
    await close(current, { code: 'invalid-backup' }).expect(429);
    assert((await p.adminMfa.findUnique({ where: { userId: current.user.id } })).lockedUntil > new Date());
    assert(await p.refreshToken.findUnique({ where: { id: other.row.id } }));
});

test('A recovery code may close other sessions but the final code stays reserved for account recovery', async () => {
    const { current, codes } = await enabled(); await session(current.user);
    await close(current, { code: codes[0] }).expect(200); const other = await session(current.user);
    await close(current, { code: codes[1] }).expect(409);
    assert(await p.refreshToken.findUnique({ where: { id: other.row.id } }));
    const state = await p.adminMfa.findUnique({ where: { userId: current.user.id } }); assert.equal(state.recoveryHashes.length, 1); assert(state.enabledAt);
});

test('Repeated concurrent requests produce one audit action without terminating the current session', async () => {
    const current = await session(await account()); await session(current.user); await session(current.user); await session(current.user);
    const results = await Promise.all([close(current), close(current), close(current)]);
    assert(results.every(r => r.status === 200)); assert.equal(results.reduce((sum, r) => sum + r.body.data.closed, 0), 3);
    assert.equal(await p.accessEvent.count({ where: { actorId: current.user.id, action: 'OTHER_BROWSER_SESSIONS_CLOSED' } }), 1);
    assert.deepEqual(await p.refreshToken.findUnique({ where: { id: current.row.id } }), current.row);
});

test('An invalidated account or current session cannot close the other sessions', async () => {
    for (const change of ['revoked', 'disabled', 'version']) {
        const current = await session(await account()), other = await session(current.user);
        if (change === 'revoked') await p.refreshToken.delete({ where: { id: current.row.id } });
        if (change === 'disabled') await p.user.update({ where: { id: current.user.id }, data: { isActive: false } });
        if (change === 'version') await p.user.update({ where: { id: current.user.id }, data: { authVersion: 1 } });
        await close(current).expect(401); assert(await p.refreshToken.findUnique({ where: { id: other.row.id } }));
    }
});

test('Pagination scans bounded legacy rows and can reach a valid browser session after an empty page', async () => {
    const current = await session(await account()), old = await session(current.user, new Date(Date.now() - 900000));
    await p.refreshToken.createMany({ data: Array.from({ length: 501 }, (_, i) => ({ userId: current.user.id, token: 'malformed-' + randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(Date.now() - 1000 - i * 1000) })) });
    const first = (await list(current).expect(200)).body.data; assert.equal(first.others.length, 0); assert(first.nextCursor);
    const second = (await list(current, first.nextCursor).expect(200)).body.data; assert.equal(second.others.length, 1); assert.equal(second.others[0].id, old.row.id); assert.equal(second.nextCursor, null);
});

test('The bounded close operation rolls back early deletions and MFA consumption if too many rows exist', async () => {
    const { current, secret } = await enabled(), other = await session(current.user);
    await p.refreshToken.createMany({ data: Array.from({ length: 5001 }, () => ({ userId: current.user.id, token: 'malformed-' + randomBytes(16).toString('hex'), expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(Date.now() - 1000) })) });
    await close(current, { code: mfa.mfaTotp(secret).generate() }).expect(409);
    assert(await p.refreshToken.findUnique({ where: { id: other.row.id } })); assert.equal((await p.adminMfa.findUnique({ where: { userId: current.user.id } })).lastUsedStep, null);
    assert.equal(await p.accessEvent.count({ where: { actorId: current.user.id, action: 'OTHER_BROWSER_SESSIONS_CLOSED' } }), 0);
});
