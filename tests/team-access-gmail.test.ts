import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
let decryptDeskcommValue: typeof import("../backend/src/lib/deskcomm-config").decryptDeskcommValue;
let processAccessMail: typeof import("../backend/src/lib/password-reset").processAccessMail;
let resetHash: typeof import("../backend/src/lib/password-reset").resetHash;
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const name = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(name);
process.env.IMAD_AUTH_MAIL_WORKER_DISABLED = "true";
let p: any, app: any, owner: any, reader: any, ownerToken: string, readerToken: string;
const pwd = "Fictitious-Owner-Password-2026", gmailSecret = "abcdefghijklmnop";
const bearer = (token: string) => ({ Authorization: "Bearer " + token });
const access = (user: any, extra: any = {}) => jwt.sign({ id: user.id, email: user.email, role: user.role, sv: user.authVersion, permissions: user.permissions, ...extra }, process.env.JWT_SECRET!);
let commerce: string;
async function commerceSnapshot() { return JSON.stringify({ orders: await p.order.findMany({ orderBy: { id: "asc" } }), products: await p.product.count(), parcels: await p.olivraisonShipment.count(), events: await p.orderEvent.count(), outbox: await p.deskcommOutbox.count() }); }
before(async () => {
    await createDatabase(name);
    ({ decryptDeskcommValue } = await import("../backend/src/lib/deskcomm-config"));
    ({ processAccessMail, resetHash } = await import("../backend/src/lib/password-reset"));
    ({ prisma: p } = await import("../backend/src/lib/prisma")); ({ app } = await import("../backend/src/app"));
    const passwordHash = await bcrypt.hash(pwd, 10);
    owner = await p.user.create({ data: { email: "owner@example.invalid", firstName: "Test", lastName: "Owner", role: "ADMIN", passwordHash } });
    reader = await p.user.create({ data: { email: "reader@example.invalid", firstName: "Test", lastName: "Reader", role: "STAFF", permissions: ["orders.read"], passwordHash } });
    ownerToken = access(owner); readerToken = access(reader);
    await p.order.create({ data: { id: "aabbccddeeff001122334455", status: "PENDING", paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 230, shippingCost: 30, customerName: "FICTIF", customerPhone: "+212600000099", city: "Rabat", inventoryReserved: false } });
    commerce = await commerceSnapshot();
});
after(async () => { await p?.$disconnect(); await dropDatabase(name); });
const gmailBody = (revision = 0, extra: any = {}) => ({ enabled: true, gmailUser: "sender@example.invalid", port: 465, appPassword: gmailSecret, currentPassword: pwd, revision, ...extra });

test("Stored permissions, not JWT claims or hidden buttons, govern every protected module", async () => {
    await request(app).get('/api/orders').set(bearer(readerToken)).expect(200);
    await request(app).get('/api/orders/aabbccddeeff001122334455/customer-history').set(bearer(readerToken)).expect(200);
    for (const path of ['/api/team', '/api/team/gmail', '/api/orders/export.csv', '/api/products/admin/catalog', '/api/content/admin', '/api/analytics/summary', '/api/integrations/deskcomm', '/api/integrations/olivraison'])
        await request(app).get(path).set(bearer(readerToken)).expect(403);
    await request(app).patch('/api/orders/aabbccddeeff001122334455/status').set(bearer(readerToken)).send({ status: 'CONFIRMED' }).expect(403);
    await request(app).put('/api/settings').set(bearer(access(reader, { permissions: ['settings.manage'] }))).send({}).expect(403);
    await request(app).get('/api/team').set(bearer(access(reader, { role: 'ADMIN' }))).expect(401);
    await request(app).get('/api/team').expect(401);
    assert.equal(await commerceSnapshot(), commerce);
});

test("Gmail configuration is administrator-only, encrypted, versioned and never returned through public settings", async () => {
    let response = await request(app).get('/api/team/gmail').set(bearer(ownerToken)).expect(200);
    assert.equal(response.body.data.gmailUser, owner.email); assert.equal(response.body.data.enabled, false);
    await request(app).put('/api/team/gmail').set(bearer(ownerToken)).send(gmailBody(0, { currentPassword: 'wrong' })).expect(400);
    response = await request(app).put('/api/team/gmail').set(bearer(ownerToken)).send(gmailBody()).expect(200);
    assert.equal(response.body.data.hasPassword, true); assert.equal(response.body.data.revision, 1);
    assert.equal(JSON.stringify(response.body).includes(gmailSecret), false);
    const cfg = await p.gmailConfig.findUnique({ where: { id: 'gmail' } });
    assert.notEqual(cfg.passwordCiphertext, gmailSecret); assert.equal(decryptDeskcommValue(cfg.passwordCiphertext), gmailSecret);
    await request(app).put('/api/team/gmail').set(bearer(ownerToken)).send(gmailBody(0)).expect(409);
    await request(app).put('/api/team/gmail').set(bearer(ownerToken)).send(gmailBody(1, { appPassword: '', gmailUser: 'different@example.invalid' })).expect(400);
    await request(app).put('/api/team/gmail').set(bearer(ownerToken)).send(gmailBody(1, { appPassword: '', port: 587 })).expect(200);
    assert.equal((await p.gmailConfig.findUnique({ where: { id: 'gmail' } })).passwordCiphertext, cfg.passwordCiphertext);
    const publicSettings = await request(app).get('/api/settings').expect(200);
    assert.equal(JSON.stringify(publicSettings.body).includes('passwordCiphertext'), false);
    assert.equal(JSON.stringify(publicSettings.body).includes('gmailUser'), false);
    assert.equal(await commerceSnapshot(), commerce);
});

test("The Gmail transport enforces TLS and a fixed host, verifies without sending, and uses trusted fragment-only reset links", async () => {
    const nodemailer = require('nodemailer'), original = nodemailer.createTransport;
    const socket = require('node:net').Socket.prototype, connect = socket.connect;
    socket.connect = function (...args: any[]) {
        const inputs = args.flat(Infinity);
        if (inputs.some(value => [465, 587].includes(Number(value?.port ?? value))))
            throw new Error('External SMTP connections are forbidden in this isolated test');
        return connect.apply(this, args);
    };
    const options: any[] = [], messages: any[] = []; let closes = 0, fail = false;
    nodemailer.createTransport = (config: any) => {
        options.push(config);
        return { verify: async () => { if (fail) throw new Error('Fictitious secret ' + gmailSecret); return true; }, close: () => { closes++; }, sendMail: async (mail: any) => { messages.push(mail); return {}; } };
    };
    const previousUrl = process.env.SITE_URL;
    try {
        const response = await request(app).post('/api/team/gmail/test').set(bearer(ownerToken)).send({}).expect(200);
        assert.deepEqual(response.body.data, { connected: true, emailSent: false });
        assert.equal(messages.length, 0); assert.equal(closes, 1);
        assert.equal(options[0].host, 'smtp.gmail.com'); assert.equal(options[0].port, 587);
        assert.equal(options[0].secure, false); assert.equal(options[0].requireTLS, true);
        assert.equal(options[0].tls.minVersion, 'TLSv1.2'); assert.equal(options[0].auth.pass, gmailSecret);
        await p.gmailConfig.update({ where: { id: 'gmail' }, data: { port: 465 } });
        await request(app).post('/api/team/gmail/test').set(bearer(ownerToken)).send({}).expect(200);
        assert.equal(options[1].port, 465); assert.equal(options[1].secure, true); assert.equal(options[1].requireTLS, true);
        fail = true;
        const error = await request(app).post('/api/team/gmail/test').set(bearer(ownerToken)).send({}).expect(502);
        assert.equal(JSON.stringify(error.body).includes(gmailSecret), false); assert.equal(closes, 3);
        process.env.SITE_URL = 'https://fixture-store.example.invalid';
        const { sendAccessMail } = await import('../backend/src/lib/gmail-smtp');
        const token = 'B'.repeat(43);
        await sendAccessMail('recipient@example.invalid', token, 'RESET', resetHash(token));
        assert.equal(messages.length, 1);
        const link = new URL(messages[0].text.match(/https:\/\/\S+/)[0]);
        assert.equal(link.origin, process.env.SITE_URL); assert.equal(link.pathname, '/admin/password'); assert.equal(link.search, '');
        assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), token);
        assert.equal(messages[0].from.address, 'sender@example.invalid');
        process.env.SITE_URL = 'https://fixture-store.example.invalid/untrusted-path';
        await assert.rejects(() => sendAccessMail('recipient@example.invalid', token, 'RESET', resetHash(token)));
        assert.equal(messages.length, 1);
    } finally { socket.connect = connect; nodemailer.createTransport = original; if (previousUrl === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = previousUrl; }
    assert.equal(await commerceSnapshot(), commerce);
});

test("New accounts receive a single queued invitation, no password or link in the API response, and cannot log in before setup", async () => {
    const body = { email: 'New.User@Example.invalid', firstName: 'New', lastName: 'User', role: 'STAFF', permissions: ['orders.read'], currentPassword: pwd };
    const response = await request(app).post('/api/team').set(bearer(ownerToken)).send(body).expect(201);
    const user = await p.user.findUnique({ where: { id: response.body.data.id } });
    assert.equal(user.email, 'new.user@example.invalid'); assert.equal(user.mustSetPassword, true);
    assert.deepEqual(Object.keys(response.body.data).sort(), ['id','email','firstName','lastName','role','permissions','isActive','mustSetPassword','createdAt'].sort());
    await request(app).post('/api/team').set(bearer(ownerToken)).send(body).expect(409);
    assert.equal(await p.user.count({ where: { email: user.email } }), 1);
    await request(app).post('/api/auth/login').send({ email: user.email, password: pwd }).expect(401);
    const job = await p.passwordReset.findUnique({ where: { userId: user.id } });
    assert.equal(job.kind, 'INVITE'); assert.equal(job.mailState, 'PENDING');
    const token = decryptDeskcommValue(job.mailCiphertext);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/); assert.equal(resetHash(token), job.tokenHash);
    const sent: any[] = [];
    const sender = async (...args: any[]) => { sent.push(args); await new Promise(resolve => setTimeout(resolve, 20)); };
    await Promise.all([processAccessMail(sender), processAccessMail(sender)]);
    assert.equal(sent.length, 1); assert.equal(sent[0][0], user.email); assert.equal(sent[0][1], token);
    assert.equal((await p.passwordReset.findUnique({ where: { userId: user.id } })).mailCiphertext, null);
    const outcomes = await Promise.all([1,2].map(() => request(app).post('/api/auth/reset-password').send({ token, password: 'New-Fictitious-Password-2026' })));
    assert.deepEqual(outcomes.map(r => r.status).sort(), [200,400]);
    const saved = await p.user.findUnique({ where: { id: user.id } });
    assert.equal(saved.mustSetPassword, false); assert.equal(saved.authVersion, 1);
    assert.equal(await bcrypt.compare('New-Fictitious-Password-2026', saved.passwordHash), true);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'New-Fictitious-Password-2026' }).expect(200);
    assert.equal(await commerceSnapshot(), commerce);
});

test("Changing permissions and disabling accounts revoke access and refresh tokens immediately, while preserving the administrator", async () => {
    const login = await request(app).post('/api/auth/login').send({ email: reader.email, password: pwd }).expect(200);
    const body = { firstName: reader.firstName, lastName: reader.lastName, role: 'STAFF', permissions: ['analytics.read'], isActive: true, currentPassword: pwd };
    await request(app).patch('/api/team/'+reader.id).set(bearer(ownerToken)).send(body).expect(200);
    await request(app).get('/api/orders').set(bearer(readerToken)).expect(401);
    await request(app).post('/api/auth/refresh').send({ token: login.body.data.refreshToken }).expect(401);
    const next = await request(app).post('/api/auth/login').send({ email: reader.email, password: pwd }).expect(200);
    await request(app).get('/api/orders').set(bearer(next.body.data.accessToken)).expect(403);
    await request(app).get('/api/analytics/summary').set(bearer(next.body.data.accessToken)).expect(200);
    await request(app).patch('/api/team/'+reader.id).set(bearer(ownerToken)).send({ ...body, isActive: false }).expect(200);
    await request(app).get('/api/analytics/summary').set(bearer(next.body.data.accessToken)).expect(401);
    await request(app).post('/api/auth/login').send({ email: reader.email, password: pwd }).expect(401);
    await request(app).patch('/api/team/'+owner.id).set(bearer(ownerToken)).send({ ...body, role: 'ADMIN', isActive: false }).expect(409);
    assert.equal((await p.user.findUnique({ where: { id: owner.id } })).isActive, true);
    assert.equal(await commerceSnapshot(), commerce);
});

test("Concurrent administrators cannot revoke the last working administrator through a stale session", async () => {
    const second = await p.user.create({ data: { email: 'second-owner@example.invalid', firstName: 'Second', lastName: 'Test', role: 'ADMIN', passwordHash: await bcrypt.hash(pwd,10) } });
    const body = { firstName: 'Test', lastName: 'Owner', role: 'ADMIN', permissions: [], isActive: false, currentPassword: pwd };
    const results = await Promise.all([
        request(app).patch('/api/team/'+second.id).set(bearer(ownerToken)).send(body),
        request(app).patch('/api/team/'+owner.id).set(bearer(access(second))).send(body),
    ]);
    assert.equal(results.filter(r => r.status === 200).length, 1);
    assert.ok(results.some(r => [400,401,409].includes(r.status)));
    assert.equal(await p.user.count({ where: { role: 'ADMIN', isActive: true, mustSetPassword: false } }), 1);
    owner = await p.user.update({ where: { id: owner.id }, data: { isActive: true } });
    await p.user.update({ where: { id: second.id }, data: { isActive: false } });
    ownerToken = access(owner);
    assert.equal(await commerceSnapshot(), commerce);
});

test("Forgot-password responses are identical, do not reveal accounts, and deduplicate requests; SMTP failures do not replay ambiguous sends", async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email: owner.email }).expect(202);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.invalid' }).expect(202);
    assert.deepEqual(known.body, unknown.body);
    let row = await p.passwordReset.findUnique({ where: { userId: owner.id } });
    const token = decryptDeskcommValue(row.mailCiphertext);
    await request(app).post('/api/auth/forgot-password').send({ email: owner.email }).expect(202);
    assert.equal((await p.passwordReset.findUnique({ where: { userId: owner.id } })).tokenHash, row.tokenHash);
    let sends = 0;
    await processAccessMail(async () => { sends++; throw new Error('Fictitious connection lost'); });
    await processAccessMail(async () => { sends++; });
    assert.equal(sends, 1);
    row = await p.passwordReset.findUnique({ where: { userId: owner.id } });
    assert.equal(row.mailState, 'FAILED'); assert.equal(row.mailCiphertext, null);
    await p.passwordReset.update({ where: { userId: owner.id }, data: { expiresAt: new Date(Date.now()-1) } });
    await request(app).post('/api/auth/reset-password').send({ token, password: 'Another-Fictitious-Password-2026' }).expect(400);
    await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.invalid' }).expect(202);
    await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.invalid' }).expect(202);
    await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.invalid' }).expect(429);
    assert.equal(await commerceSnapshot(), commerce);
});

test("Changing one's password invalidates legacy and current sessions and leaves commerce data untouched", async () => {
    await request(app).post('/api/auth/change-password').set(bearer(ownerToken)).send({ currentPassword: 'wrong', password: 'Fictitious-Changed-Password-2026' }).expect(400);
    await request(app).post('/api/auth/change-password').set(bearer(ownerToken)).send({ currentPassword: pwd, password: 'Fictitious-Changed-Password-2026' }).expect(200);
    await request(app).get('/api/team').set(bearer(ownerToken)).expect(401);
    await request(app).get('/api/team').set(bearer(access(owner, { sv: undefined }))).expect(401);
    await request(app).post('/api/auth/login').send({ email: owner.email, password: 'Fictitious-Changed-Password-2026' }).expect(200);
    assert.equal(await commerceSnapshot(), commerce);
});
