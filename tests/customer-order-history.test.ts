import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { customerPhoneRows, readCustomerOrderHistory } from "../backend/src/lib/customer-order-history";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const database = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(database);
process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = "false";
let p: any, app: any, snapshot: string;
const prefix = randomBytes(8).toString("hex"), id = (n: number) => prefix + n.toString(16).padStart(8, "0");
const admin = { Authorization: `Bearer ${jwt.sign({ id: "123456789012345678901234", role: "ADMIN" }, process.env.JWT_SECRET!)}` };
const base = { paymentMethod: "COD", paymentStatus: "PENDING", totalAmount: 230, shippingCost: 30, customerName: "Recette fictive", customerPhone: "+212600000099", city: "Rabat", inventoryReserved: false };
const row = (n: number, date: string, status = "CANCELLED", extra: any = {}) => ({ ...base, id: id(n), createdAt: new Date(date), status, ...extra });
const phones: [string | null, string | null, string | null][] = [
    ["+212 6 11 11 11 11", null, "212611111111"], ["00212 611111111", null, "212611111111"],
    ["06.11.11.11.11", null, "212611111111"], ["611111111", null, "212611111111"],
    ["212611111111", null, "212611111111"], ["\t+212 (611) 111-111\n", null, "212611111111"],
    ["+33 6 11 11 11 11", null, "33611111111"], ["0033 611111111", null, "33611111111"],
    ["+2120611111111", null, null], ["111", null, null], ["+212invalid", "0611111111", null],
    ["  ", "0611111111", "212611111111"], [null, null, null], ["++212611111111", null, null],
    ["0611111112", null, "212611111112"], ["0611111111", "+33611111111", "212611111111"],
];
const expectedIds = [1,2,3,4,5,6,12,...Array.from({ length: 130 }, (_, n) => n + 1000)].map(id);
async function integrity() { return JSON.stringify({
    orders: await p.order.findMany({ orderBy: { id: "asc" } }),
    stock: await p.productVariant.findMany({ select: { id: true, stock: true } }),
    shipments: await p.olivraisonShipment.findMany({ orderBy: { id: "asc" } }),
    events: await p.orderEvent.findMany({ orderBy: { id: "asc" } }),
    outbox: await p.deskcommOutbox.count(), notifications: await p.adminNotification.count(),
}); }
before(async () => {
    await createDatabase(database);
    ({ prisma: p } = await import("../backend/src/lib/prisma"));
    await p.user.upsert({ where: { id: "123456789012345678901234" }, create: { id: "123456789012345678901234", email: "fixture-admin@example.invalid", passwordHash: "fixture-no-login", firstName: "Test", lastName: "Admin", role: "ADMIN" }, update: {} }); ({ app } = await import("../backend/src/app"));
    await p.order.createMany({ data: [
        row(1, "2026-11-22T10:00:00Z", "PENDING"), row(2, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: "06 00 00 00 99" }),
        row(3, "2021-01-01T10:00:00Z", "CANCELLED", { customerPhone: "00212 600000099", deletedAt: new Date("2026-11-01T10:00:00Z") }),
        row(4, "2022-01-01T10:00:00Z", "DELIVERED", { customerPhone: "212600000099", paymentStatus: "PAID" }),
        row(5, "2027-01-01T10:00:00Z"), row(6, "2026-11-22T10:00:00Z"),
        row(7, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: "invalid", phone: "+212600000099" }),
        row(8, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: "+33 6 00 00 00 99" }),
        row(9, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: "+212600000098" }),
        row(10, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: null }),
        row(11, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: "099" }),
        row(12, "2023-01-01T10:00:00Z", "CANCELLED", { customerPhone: "  ", phone: "(06) 00 00 00 99" }),
        row(13, "2020-01-01T10:00:00Z", "CANCELLED", { customerPhone: "+212600000088" }),
        ...Array.from({ length: 130 }, (_, n) => row(n+1000, "1999-01-01T10:00:00Z", "DELIVERED")),
        ...phones.map(([customerPhone, phone], n) => row(n+2000, "2020-01-01T10:00:00Z", "PENDING", { customerPhone, phone })),
    ] });
    await p.orderEvent.createMany({ data: [
        { orderId: id(2), type: "status_changed", message: "Order marked as CANCELLED (admin)", createdAt: new Date("2020-01-02T10:00:00Z") },
        { orderId: id(2), type: "trashed", message: "Private later maintenance", createdAt: new Date("2026-11-22T10:00:00Z") },
        { orderId: id(4), type: "status_changed", message: "Order marked as CANCELLED (admin)", createdAt: new Date("2022-01-01T11:00:00Z") },
    ] });
    const c = await p.category.create({ data: { slug: "customer-history", nameFr: "Test", nameAr: "اختبار", nameEn: "Test" } });
    const product = await p.product.create({ data: { slug: "customer-history", nameFr: "Test", nameAr: "اختبار", nameEn: "Test", descriptionFr: "", descriptionAr: "", descriptionEn: "", price: 200, images: [], categoryId: c.id } });
    await p.productVariant.create({ data: { productId: product.id, sku: "CUSTOMER-HISTORY-TEST", color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", stock: 7 } });
    await p.olivraisonShipment.create({ data: { id: id(2), trackingId: "FICTIF-HISTORY", state: "DONE", carrierStatus: "CANCELLED" } });
    snapshot = await integrity();
});
after(async () => { await p?.$disconnect(); await dropDatabase(database); });
const history = (n: number, page = 1) => request(app).get(`/api/orders/${id(n)}/customer-history`).query({ page }).set(admin).expect(200);

test("Phone identity uses complete canonical numbers, keeps country codes and never substitutes a populated primary contact", async () => {
    const rows = await p.$queryRaw(Prisma.sql`SELECT id, phone_key FROM (${customerPhoneRows(Prisma.sql`id IN (${Prisma.join(phones.map((_, n) => id(n+2000)))})`)}) p`);
    const keys = new Map(rows.map((r: any) => [r.id, r.phone_key]));
    phones.forEach(([, , expected], n) => assert.equal(keys.get(id(n+2000)), expected, 'phone case ' + n));
});

test("Admin summaries find earlier cancellations beyond loaded/filtered rows and include retained trash without self or future matches", async () => {
    for (const [n, count] of [[1,3],[2,0],[5,4],[6,3],[12,2],[13,0]]) {
        const r = await request(app).get(`/api/orders/${id(n)}/admin-details`).set(admin).expect(200);
        assert.deepEqual(r.body.data.customerHistory, { available: true, priorCancelledCount: count });
    }
    const r = await request(app).get('/api/orders').query({ search: id(1), status: 'PENDING', payment: 'PENDING', limit: 1 }).set(admin).expect(200);
    assert.equal(r.body.total, 1); assert.equal(r.body.data[0].customerHistory.priorCancelledCount, 3);
    assert.equal(r.body.data[0].status, 'PENDING'); assert.equal(r.body.data[0].paymentStatus, 'PENDING');
    for (const n of [7,10,11]) {
        const r = await request(app).get(`/api/orders/${id(n)}/admin-details`).set(admin).expect(200);
        assert.deepEqual(r.body.data.customerHistory, { available: false, priorCancelledCount: 0 });
    }
});

test("The earlier-order boundary remains identical in different PostgreSQL session time zones", async () => {
    for (const timezone of ['UTC', 'Africa/Casablanca', 'America/Los_Angeles']) {
        const result = await p.$transaction(async (tx: any) => {
            await tx.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', ${timezone}, true)`);
            return readCustomerOrderHistory(tx, id(1), 1);
        });
        assert.equal(result.priorCancelledCount, 3, timezone);
        assert.equal(result.total, 137, timezone);
    }
    assert.equal(await integrity(), snapshot);
});

test("The history paginates all exact-number orders once, shows retained trash and reports known cancellation dates only", async () => {
    const ids: string[] = [];
    for (let page = 1; page <= 6; page++) {
        const r = await history(1, page);
        assert.equal(r.body.anchorOrderId, id(1)); assert.equal(r.body.phone, '+212600000099');
        assert.equal(r.body.total, 137); assert.equal(r.body.totalPages, 6); assert.equal(r.body.page, page);
        assert.equal(r.body.priorCancelledCount, 3);
        ids.push(...r.body.data.map((row: any) => row.id));
        for (const row of r.body.data) {
            assert.deepEqual(Object.keys(row).sort(), ['id','createdAt','status','deletedAt','totalAmount','paymentStatus','cancelledAt'].sort());
            assert.equal(row.cancelledAt, row.id === id(2) ? '2020-01-02T10:00:00.000Z' : null);
        }
    }
    assert.equal(new Set(ids).size, 137); assert.deepEqual([...ids].sort(), [...expectedIds].sort());
    assert.equal((await history(1, 999)).body.page, 6);
    const first = (await history(1)).body.data;
    assert.equal(first.find((r: any) => r.id === id(3)).deletedAt, '2026-11-01T10:00:00.000Z');
    assert.equal(first.find((r: any) => r.id === id(4)).paymentStatus, 'PAID');
    assert.equal(await integrity(), snapshot);
});

test("Customer history is admin-only, validates pagination and does not expose associations on public tracking", async () => {
    await request(app).get(`/api/orders/${id(1)}/customer-history`).expect(401);
    const token = jwt.sign({ id: '123456789012345678901234', role: 'CUSTOMER' }, process.env.JWT_SECRET!);
    await request(app).get(`/api/orders/${id(1)}/customer-history`).set('Authorization', `Bearer ${token}`).expect(403);
    for (const q of [{ page: 0 }, { page: 'bad' }, { page: 1000001 }, { phone: '+212600000099' }, { limit: 100 }])
        await request(app).get(`/api/orders/${id(1)}/customer-history`).query(q).set(admin).expect(400);
    for (const n of [7,10,11]) await request(app).get(`/api/orders/${id(n)}/customer-history`).set(admin).expect(422);
    await request(app).get(`/api/orders/${id(3)}/customer-history`).set(admin).expect(404);
    await request(app).get(`/api/orders/${id(999)}/customer-history`).set(admin).expect(404);
    const publicOrder = await request(app).get(`/api/orders/${id(1)}`).expect(200);
    assert.deepEqual(Object.keys(publicOrder.body.data).sort(), ['id','status','paymentStatus','createdAt'].sort());
    assert.equal(await integrity(), snapshot);
});

test("Restoring trash does not erase cancellation history and correcting a previous status refreshes the warning without writes by reads", async () => {
    const old = await p.order.findUnique({ where: { id: id(3) } });
    try {
        await p.order.update({ where: { id: id(3) }, data: { deletedAt: null } });
        let before = await integrity(); assert.equal((await history(1)).body.priorCancelledCount, 3); assert.equal(await integrity(), before);
        await p.order.update({ where: { id: id(3) }, data: { status: 'DELIVERED' } });
        before = await integrity(); assert.equal((await history(1)).body.priorCancelledCount, 2);
        const r = await request(app).get(`/api/orders/${id(1)}/admin-details`).set(admin).expect(200);
        assert.equal(r.body.data.customerHistory.priorCancelledCount, 2); assert.equal(await integrity(), before);
    } finally { await p.order.update({ where: { id: id(3) }, data: { status: old.status, deletedAt: old.deletedAt, updatedAt: old.updatedAt } }); }
    assert.equal(await integrity(), snapshot);
});
