import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const name = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(name);
process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = "false";
process.env.IMAD_AUTH_MAIL_WORKER_DISABLED = "true";
let p: any, app: any, enqueue: any, worker: any, transition: any, owner: any, reader: any, product: any, variant: any;
const base = { paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 230, shippingCost: 30, customerName: "TEST FICTIF", customerPhone: "+212600000099", city: "Rabat", street: "Adresse de recette fictive", inventoryReserved: false };
const phone = (n: number) => "+2126" + String(n).padStart(8, "0");
const token = (user: any) => ({ Authorization: 'Bearer ' + jwt.sign({ id: user.id, role: user.role, sv: user.authVersion }, process.env.JWT_SECRET!) });
const url = (id: string) => `/api/orders/${id}/olivraison-approve`;
async function pair(n: number) {
    const old = await p.order.create({ data: { ...base, customerPhone: phone(n), status: 'CANCELLED', createdAt: new Date('2020-01-01'), deletedAt: new Date('2021-01-01') } });
    const order = await p.order.create({ data: { ...base, customerPhone: phone(n), status: 'CONFIRMED', items: { create: { productId: product.id, variantId: variant.id, quantity: 1, unitPrice: 200 } } } });
    return { old, order };
}
async function queue(order: any) { await p.$transaction((tx: any) => enqueue(tx, order)); }
async function quiet() { await p.olivraisonShipment.updateMany({ where: { state: { not: 'REVIEW_REQUIRED' } }, data: { state: 'DONE' } }); }
async function protect() { return JSON.stringify({ stock: await p.productVariant.findMany({ select: { id: true, stock: true } }), payments: await p.order.findMany({ orderBy: { id: 'asc' }, select: { id: true, paymentStatus: true, paymentMethod: true, totalAmount: true, inventoryReserved: true } }) }); }
const cfg = { id: 'olivraison', enabled: true, autoPickup: true, activatedAt: new Date('2022-01-01'), credentials: 'injected-test-only', pickupAddress: { streetAddress: 'Fictitious test street', city: 'Rabat', phone: '0600000000', company: 'TEST' } };
before(async () => {
    await createDatabase(name);
    ({ prisma: p } = await import('../backend/src/lib/prisma')); ({ app } = await import('../backend/src/app'));
    ({ enqueueOlivraison: enqueue } = await import('../backend/src/lib/olivraison-enqueue'));
    ({ processOlivraisonQueue: worker } = await import('../backend/src/lib/olivraison'));
    ({ transitionOrderStatus: transition } = await import('../backend/src/lib/order-lifecycle'));
    owner = await p.user.create({ data: { email: 'owner@example.invalid', passwordHash: 'no-login', role: 'ADMIN', firstName: 'Test', lastName: 'Owner' } });
    reader = await p.user.create({ data: { email: 'reader@example.invalid', passwordHash: 'no-login', role: 'STAFF', firstName: 'Test', lastName: 'Reader', permissions: ['orders.read'] } });
    const category = await p.category.create({ data: { slug: 'carrier-test', nameFr: 'TEST', nameAr: 'اختبار', nameEn: 'TEST' } });
    product = await p.product.create({ data: { slug: 'carrier-test', categoryId: category.id, nameFr: 'TEST', nameAr: 'اختبار', nameEn: 'TEST', descriptionFr: '', descriptionAr: '', descriptionEn: '', price: 200, images: [], status: 'ACTIVE' } });
    variant = await p.productVariant.create({ data: { productId: product.id, sku: 'CARRIER-TEST', color: '#000000', colorNameFr: 'Noir', colorNameAr: 'أسود', colorNameEn: 'Black', stock: 100 } });
    await p.olivraisonIntegration.create({ data: cfg });
});
after(async () => { await p?.$disconnect(); await dropDatabase(name); });

test('Site checkout holds repeated phone cancellations before creating a carrier parcel, including idempotent replay', async () => {
    await pair(10);
    await p.storeSettings.create({ data: { id: 'settings', directSiteConfirmation: true } });
    const body = { confirmationMode: 'SITE', customer: { fullName: 'TEST FICTIF', phone: phone(10), street: 'Adresse de recette fictive', city: 'Rabat', region: 'Rabat' }, items: [{ productId: product.id, variantId: variant.id, quantity: 1 }] };
    const key = 'carrier-test-' + randomBytes(10).toString('hex');
    const result = await request(app).post('/api/orders').set('Idempotency-Key', key).send(body).expect(201);
    const order = result.body.data; assert.equal(order.status, 'CONFIRMED'); assert.equal(order.confirmationMethod, 'SITE');
    const before = await protect();
    await request(app).post('/api/orders').set('Idempotency-Key', key).send(body).expect(200);
    assert.equal(await p.olivraisonShipment.count({ where: { id: order.id } }), 1);
    assert.equal((await p.olivraisonShipment.findUnique({ where: { id: order.id } })).state, 'REVIEW_REQUIRED');
    let calls = 0; await worker(async () => { calls++; throw new Error('External calls forbidden'); }); assert.equal(calls, 0);
    const list = await request(app).get(`/api/orders/${order.id}/admin-details`).set(token(owner)).expect(200);
    assert.equal(list.body.data.shipment.approvedAt, null); assert.equal(list.body.data.customerHistory.priorCancelledCount, 1);
    assert.equal(await protect(), before);
});

test('CRM and administration confirmations cannot approve shipping implicitly', async () => {
    for (const source of ['admin', 'crm']) {
        const { order } = await pair(source === 'admin' ? 11 : 12);
        await p.order.update({ where: { id: order.id }, data: { status: 'PENDING' } });
        if (source === 'crm') await p.deskcommOutbox.create({ data: { orderId: order.id, status: 'SENT', payload: {} } });
        await transition(order.id, 'CONFIRMED', source, source === 'crm' ? { deliveryId: randomBytes(16).toString('hex'), leadId: 'fictitious-lead', fingerprint: 'fictitious' } : undefined);
        assert.equal((await p.olivraisonShipment.findUnique({ where: { id: order.id } })).state, 'REVIEW_REQUIRED');
    }
});

test('One explicit authenticated approval unlocks only its order, concurrent retries preserve one audit and parcel identity', async () => {
    const { order } = await pair(13); await queue(order);
    const before = await protect();
    await request(app).patch(`/api/orders/${order.id}/status`).set(token(owner)).send({ status: "SHIPPED" }).expect(409);
    await request(app).post(url(order.id)).send({ approve: true }).expect(401);
    await request(app).post(url(order.id)).set(token(reader)).send({ approve: true }).expect(403);
    for (const body of [{}, { approve: false }, { approve: true, approvedAt: new Date().toISOString() }])
        await request(app).post(url(order.id)).set(token(owner)).send(body).expect(400);
    const results = await Promise.all(Array.from({ length: 3 }, () => request(app).post(url(order.id)).set(token(owner)).send({ approve: true })));
    assert.deepEqual(results.map(r => r.status), [200,200,200]);
    const saved = await p.olivraisonShipment.findUnique({ where: { id: order.id } });
    assert(saved.approvedAt); assert.equal(saved.approvedBy, owner.id); assert.equal(saved.state, 'QUEUED'); assert.equal(saved.trackingId, null);
    assert.equal(await p.orderEvent.count({ where: { orderId: order.id, type: 'carrier_manual_approved' } }), 1);
    assert.equal(await p.olivraisonShipment.count({ where: { id: order.id } }), 1);
    assert.equal(await protect(), before);
    const { order: other } = await pair(14); await queue(other);
    assert.equal((await p.olivraisonShipment.findUnique({ where: { id: other.id } })).state, 'REVIEW_REQUIRED');
    await quiet();
});

test('The worker catches old queued or forcibly retried shipments, never bypassing review through retry', async () => {
    const { order } = await pair(15);
    await p.olivraisonShipment.create({ data: { id: order.id, state: 'RETRY', nextAttemptAt: new Date(0) } });
    let calls = 0; const before = await protect(); await worker(async () => { calls++; throw new Error('No external calls'); });
    assert.equal(calls, 0); assert.equal((await p.olivraisonShipment.findUnique({ where: { id: order.id } })).state, 'REVIEW_REQUIRED');
    await request(app).post(`/api/integrations/olivraison/shipments/${order.id}/retry`).set(token(owner)).expect(409);
    assert.equal(await protect(), before);
});

test('History is checked again after reading cities and before external creation', async () => {
    const order = await p.order.create({ data: { ...base, customerPhone: phone(16), status: 'CONFIRMED' } }); await queue(order);
    const paths: string[] = [];
    await worker(async (path: string, method = 'GET') => {
        paths.push(method + ' ' + path); assert.equal(path, '/cities');
        await p.order.create({ data: { ...base, customerPhone: phone(16), status: 'CANCELLED', createdAt: new Date(Date.now() + 1000) } });
        return [{ name: 'Rabat', price: 30 }];
    });
    assert.deepEqual(paths, ['GET /cities']); assert.equal((await p.olivraisonShipment.findUnique({ where: { id: order.id } })).state, 'REVIEW_REQUIRED');
});

test('Existing parcels are not recreated, confirmed or picked up without approval; tracking remains read-only', async () => {
    const { order } = await pair(17); const before = await protect();
    await p.olivraisonShipment.create({ data: { id: order.id, trackingId: 'TEST-EXISTING', state: 'ACTIVE', nextAttemptAt: new Date(0) } });
    const calls: string[] = [];
    const api = async (path: string, method = 'GET') => { calls.push(method + ' ' + path); assert.equal(method, 'GET'); return { trackingID: 'TEST-EXISTING', status: 'CREATED' }; };
    await worker(api);
    let saved = await p.olivraisonShipment.findUnique({ where: { id: order.id } }); assert.equal(saved.state, 'TRACKING_ONLY'); assert.equal(saved.pickupAttempted, false);
    await p.olivraisonShipment.update({ where: { id: order.id }, data: { nextAttemptAt: new Date(0) } });
    await worker(api); assert.deepEqual(calls, ['GET /package/TEST-EXISTING','GET /package/TEST-EXISTING']);
    await request(app).post(url(order.id)).set(token(owner)).send({ approve: true }).expect(409);
    assert.equal(await protect(), before); await quiet();
});

test('A pre-existing confirmed parcel with cancellation history cannot request automatic pickup', async () => {
    const { order } = await pair(21); const before = await protect();
    await p.olivraisonShipment.create({ data: { id: order.id, trackingId: 'TEST-NO-PICKUP', state: 'ACTIVE', nextAttemptAt: new Date(0) } });
    const calls: string[] = [];
    await worker(async (path: string, method = 'GET') => { calls.push(method + ' ' + path); assert.equal(method, 'GET'); return { trackingID: 'TEST-NO-PICKUP', status: 'CONFIRMED' }; });
    const shipment = await p.olivraisonShipment.findUnique({ where: { id: order.id } });
    assert.equal(shipment.state, 'TRACKING_ONLY'); assert.equal(shipment.pickupAttempted, false);
    assert.deepEqual(calls, ['GET /package/TEST-NO-PICKUP']); assert.equal(await protect(), before); await quiet();
});

test('Repeated tracking preserves an unresolved physical-stock instruction without recreating a parcel or touching payment', async () => {
    const { refreshOlivraisonTracking } = await import('../backend/src/lib/olivraison');
    const { CARRIER_REFERENCE_MISMATCH } = await import('../backend/src/lib/olivraison-api');
    const order = await p.order.create({ data: { ...base, status: 'CANCELLED', inventoryReserved: true } });
    const note = 'Colis supprimé chez Olivraison : stock réservé conservé ; vérifier physiquement avant réintégration.';
    await p.olivraisonShipment.create({ data: { id: order.id, trackingId: 'TEST-DELETED-PHYSICAL', state: 'ATTENTION', carrierStatus: 'DELETED', lastError: note, pickupAttempted: true } });
    const before = await protect();
    const count = await p.olivraisonShipment.count();
    const calls: string[] = [];
    let status = 'DELETED';
    const read = async (path: string, method = 'GET') => {
        calls.push(method + ' ' + path);
        assert.equal(method, 'GET');
        assert.equal(path, '/package/TEST-DELETED-PHYSICAL');
        return { trackingID: 'TEST-DELETED-PHYSICAL', status };
    };
    for (let i = 0; i < 2; i++) await refreshOlivraisonTracking(order.id, read);
    let saved = await p.olivraisonShipment.findUnique({ where: { id: order.id } });
    assert.equal(saved.lastError, note);
    assert.equal(saved.state, 'ATTENTION');
    assert.equal(saved.pickupAttempted, true);
    status = 'RETURNED';
    await refreshOlivraisonTracking(order.id, read);
    saved = await p.olivraisonShipment.findUnique({ where: { id: order.id } });
    assert.equal(saved.lastError, 'Incident transporteur : rapprocher la commande, le stock et le paiement.');
    // A resolved identity mismatch must not remain as a misleading incident note.
    await p.olivraisonShipment.update({ where: { id: order.id }, data: { lastError: CARRIER_REFERENCE_MISMATCH } });
    await refreshOlivraisonTracking(order.id, read);
    assert.equal((await p.olivraisonShipment.findUnique({ where: { id: order.id } })).lastError, 'Incident transporteur : rapprocher la commande, le stock et le paiement.');
    assert.equal(calls.length, 4);
    assert.equal(await p.olivraisonShipment.count(), count);
    assert.equal(await protect(), before);
    await quiet();
});

test('Cancelled orders, removed configuration and old history cannot be approved or backfilled', async () => {
    const { order } = await pair(18); await queue(order);
    await p.olivraisonIntegration.update({ where: { id: 'olivraison' }, data: { enabled: false } });
    await request(app).post(url(order.id)).set(token(owner)).send({ approve: true }).expect(409);
    await p.olivraisonIntegration.update({ where: { id: 'olivraison' }, data: { enabled: true } });
    await transition(order.id, 'CANCELLED');
    await request(app).post(url(order.id)).set(token(owner)).send({ approve: true }).expect(409);
    const historical = await p.order.create({ data: { ...base, customerPhone: phone(19), status: 'CONFIRMED', createdAt: new Date('2020-01-01') } }); await queue(historical);
    assert.equal(await p.olivraisonShipment.findUnique({ where: { id: historical.id } }), null);
    await request(app).post(url(historical.id)).set(token(owner)).send({ approve: true }).expect(409);
});

test('Approved orders follow the normal idempotent carrier journey once; payment and stock stay unchanged', async () => {
    const { order } = await pair(20); await queue(order);
    await request(app).post(url(order.id)).set(token(owner)).send({ approve: true }).expect(200);
    const before = await protect(); const calls: string[] = [];
    let status = 'CREATED';
    const api = async (path: string, method = 'GET', body: any = {}) => {
        calls.push(method + ' ' + path);
        if (path === '/cities') return [{ name: 'Rabat', price: 30 }];
        if (path === '/package/new') { assert.equal(body.orderId, order.id); return { trackingID: 'TEST-APPROVED', status }; }
        if (path === '/package/status') { status = 'CONFIRMED'; return {}; }
        if (path === '/pickup') { status = 'PICKUP'; return { packages: [{ trackingID: 'TEST-APPROVED', status }], miniStickerFilePath: '/test-sticker.pdf', slipFilePath: '/test-slip.pdf' }; }
        return { trackingID: 'TEST-APPROVED', status };
    };
    await Promise.all([worker(api), worker(api)]);
    for (const path of ['/package/new','/package/status','/pickup']) assert.equal(calls.filter(c => c === 'POST ' + path).length, 1);
    const saved = await p.olivraisonShipment.findUnique({ where: { id: order.id } }); assert.equal(saved.trackingId, 'TEST-APPROVED'); assert.equal(saved.pickupAttempted, true);
    assert.equal(await protect(), before); await quiet();
});

test('A blacklist cancellation created after an older queued order still holds it, and approval is scoped to one order', async () => {
    const order = await p.order.create({ data: { ...base, customerPhone: phone(30), status: 'CONFIRMED', createdAt: new Date('2025-01-01') } });
    await p.order.create({ data: { ...base, customerPhone: phone(30), status: 'CANCELLED', createdAt: new Date('2026-01-01'), deletedAt: new Date('2026-02-01') } });
    await queue(order);
    const other = await p.order.create({ data: { ...base, customerPhone: phone(30), status: 'CONFIRMED' } });
    await queue(other);
    const before = await protect();
    for (const o of [order, other]) assert.equal((await p.olivraisonShipment.findUnique({ where: { id: o.id } })).state, 'REVIEW_REQUIRED');
    const details = await request(app).get(`/api/orders/${order.id}/admin-details`).set(token(owner)).expect(200);
    assert.equal(details.body.data.customerHistory.priorCancelledCount, 0);
    assert.deepEqual(details.body.data.customerBlacklist, { available: true, blocked: true, cancelledCount: 1 });
    await request(app).post(url(order.id)).set(token(owner)).send({ approve: true }).expect(200);
    assert.equal((await p.olivraisonShipment.findUnique({ where: { id: order.id } })).state, 'QUEUED');
    assert.equal((await p.olivraisonShipment.findUnique({ where: { id: other.id } })).state, 'REVIEW_REQUIRED');
    assert.equal(await protect(), before);
    await quiet();
});
