import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { orderDay } from "../apps/web/app/admin/order-utils";
import { moroccoDayBoundary, orderHistoryQuery, orderHistoryWhere } from "../backend/src/lib/order-history-query";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const database = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(database);
process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = "false";
let p: any, app: any, snapshot: string;
const admin = { Authorization: `Bearer ${jwt.sign({ id: "123456789012345678901234", role: "ADMIN" }, process.env.JWT_SECRET!)}` };
const prefix = randomBytes(8).toString("hex");
const id = (n: number) => prefix + n.toString(16).padStart(8, "0");
const statuses = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const futureBoundaries = ["2026-11-21T22:59:59Z", "2026-11-21T23:00:00Z", "2026-11-22T22:59:59Z", "2026-11-22T23:00:00Z"];
const rows = Array.from({ length: 125 }, (_, n) => ({
    id: id(n), customerName: "HISTORY-" + prefix + (n === 0 ? " Mariam" : ""),
    customerPhone: n === 0 ? "+212 6 00 00 00 99" : "+212700000000",
    city: n === 0 ? "Ancienne Tanger" : "Rabat", status: statuses[n % 5],
    paymentMethod: "COD", paymentStatus: n % 2 ? "PAID" : "PENDING",
    totalAmount: 200 + n, shippingCost: 30,
    createdAt: new Date(n === 0 ? "2020-01-01T10:00:00Z" : "2026-11-20T10:00:00Z"),
}));
async function integrity() {
    return JSON.stringify({
        orders: await p.order.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, paymentStatus: true, totalAmount: true, shippingCost: true, inventoryReserved: true, updatedAt: true } }),
        stock: await p.productVariant.findMany({ select: { id: true, stock: true } }),
        shipments: await p.olivraisonShipment.count(), events: await p.orderEvent.count(),
    });
}
before(async () => {
    await createDatabase(database);
    ({ prisma: p } = await import("../backend/src/lib/prisma"));
    ({ app } = await import("../backend/src/app"));
    await p.order.createMany({ data: rows });
    await p.order.createMany({ data: [
        { ...rows[1], id: id(130), deletedAt: new Date() },
        { ...rows[1], id: id(131), customerName: "100% QA_literal" },
        ...["2024-10-18T22:59:59Z", "2024-10-18T23:00:00Z", "2024-10-19T22:59:59Z", "2024-10-19T23:00:00Z"].map((date, i) => ({
            ...rows[1], id: id(140 + i), customerName: "Boundary", createdAt: new Date(date),
        })),
        ...futureBoundaries.map((date, i) => ({
            ...rows[1], id: id(150 + i), customerName: "Projected day", createdAt: new Date(date),
        })),
    ] });
    const category = await p.category.create({ data: { slug: "history-fixture", nameFr: "Test", nameAr: "اختبار", nameEn: "Test" } });
    const product = await p.product.create({ data: { slug: "history-fixture", nameFr: "Test", nameAr: "اختبار", nameEn: "Test", descriptionFr: "", descriptionAr: "", descriptionEn: "", price: 200, images: [], categoryId: category.id } });
    await p.productVariant.create({ data: { productId: product.id, sku: "HISTORY-TEST", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", color: "#000000", stock: 7 } });
    snapshot = await integrity();
});
after(async () => { await p?.$disconnect(); await dropDatabase(database); });
const get = (q: Record<string, string | number>) => request(app).get("/api/orders").query(q).set(admin).expect(200);

test("All historical pages are bounded and unique, with stable tie ordering beyond the first 100", async () => {
    const all: string[] = [];
    for (let page = 1; page <= 5; page++) {
        const r = await get({ search: "HISTORY-" + prefix, limit: 25, page });
        assert.equal(r.body.total, 125); assert.equal(r.body.scopeTotal, 125); assert.equal(r.body.totalPages, 5);
        assert.equal(r.body.page, page); assert.equal(r.body.data.length, 25);
        all.push(...r.body.data.map((o: any) => o.id));
        assert.equal(Object.values(r.body.statusCounts).reduce((a: number, b: any) => a + Number(b), 0), 125);
    }
    assert.equal(new Set(all).size, 125); assert.equal(all.at(-1), id(0));
    assert.equal((await get({ search: "HISTORY-" + prefix, limit: 25, page: 9999 })).body.page, 5);
    const recent = await get({ limit: 100 });
    assert.ok(!recent.body.data.some((o: any) => o.id === id(0)));
});

test("Reference, legacy name, city and formatted national/international phone find the old order", async () => {
    for (const search of ["#" + id(0).slice(-8).toUpperCase(), "Mariam", "Ancienne Tanger", "06 00 00 00 99", "+212600000099", "00212600000099"]) {
        const r = await get({ search, limit: 25 });
        assert.equal(r.body.total, 1, search); assert.equal(r.body.data[0].id, id(0));
    }
    const detail = await request(app).get(`/api/orders/${id(0)}/admin-details`).set(admin).expect(200);
    assert.equal(detail.body.data.paymentStatus, "PENDING");
    assert.equal(detail.body.data.totalAmount, 200);
});

test("Status counts, payment/date filters, sorting and trash stay scoped to the whole matching history", async () => {
    for (const day of ["2024-03-10", "2024-04-14", "2024-10-19", "2026-11-22"]) {
        const start = Date.parse(moroccoDayBoundary(day).replace(" ", "T") + "Z");
        const end = Date.parse(moroccoDayBoundary(day, true).replace(" ", "T") + "Z");
        assert.equal(orderDay(new Date(start).toISOString()), day);
        assert.notEqual(orderDay(new Date(start - 1).toISOString()), day);
        assert.equal(orderDay(new Date(end - 1).toISOString()), day);
        assert.notEqual(orderDay(new Date(end).toISOString()), day);
        assert.ok(end - start >= 23 * 3600000 && end - start <= 25 * 3600000);
    }
    const expected = rows.filter(r => r.paymentStatus === "PAID");
    const r = await get({ search: "HISTORY-" + prefix, payment: "PAID", status: "CONFIRMED", sort: "amount", limit: 25 });
    assert.equal(r.body.scopeTotal, expected.length);
    assert.equal(r.body.total, expected.filter(r => r.status === "CONFIRMED").length);
    assert.equal(r.body.data[0].totalAmount, Math.max(...expected.filter(r => r.status === "CONFIRMED").map(r => r.totalAmount)));
    const boundary = await get({ search: "Boundary", from: "2024-10-19", to: "2024-10-19" });
    assert.deepEqual(boundary.body.data.map((o: any) => o.id).sort(), [id(141), id(142)]);
    for (const timezone of ["UTC", "Africa/Casablanca", "America/Los_Angeles"]) {
        const ids = await p.$transaction(async (tx: any) => {
            await tx.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', ${timezone}, true)`);
            return tx.$queryRaw(Prisma.sql`SELECT id FROM orders WHERE ${orderHistoryWhere(orderHistoryQuery.parse({ search: "Boundary", from: "2024-10-19", to: "2024-10-19" }))} ORDER BY id`);
        });
        assert.deepEqual(ids.map((o: any) => o.id), [id(141), id(142)], timezone);
    }
    // Future offset rules can differ between PostgreSQL's tzdata and Node/browser ICU.
    // The server filter must agree with the calendar actually displayed by the interface.
    const projected = await get({ search: "Projected day", from: "2026-11-22", to: "2026-11-22" });
    assert.deepEqual(projected.body.data.map((o: any) => o.id).sort(),
        futureBoundaries.flatMap((date, i) => orderDay(date) === "2026-11-22" ? [id(150 + i)] : []));
    assert.equal((await get({ search: "HISTORY-" + prefix, trash: "true" })).body.total, 1);
    assert.equal((await get({ search: "HISTORY-" + prefix, sort: "oldest", limit: 25 })).body.data[0].id, id(0));
});

test("Search is literal, query values are validated, details require admin and reads never change commerce data", async () => {
    for (const search of ["%", "_"]) assert.equal((await get({ search })).body.total, 1);
    assert.equal((await get({ search: "%' OR 1=1--" })).body.total, 0);
    for (const q of [{ search: "x".repeat(121) }, { from: "2026-02-31" }, { from: "2026-11-23", to: "2026-11-22" }, { sort: "amount;DROP TABLE orders" }, { payment: "other" }, { page: 0 }]) {
        const r = await request(app).get("/api/orders").query(q).set(admin).expect(400);
        assert.doesNotMatch(JSON.stringify(r.body), /SELECT|postgres|Prisma|stack/);
    }
    await request(app).get("/api/orders").expect(401);
    await request(app).get(`/api/orders/${id(0)}/admin-details`).expect(401);
    const customer = jwt.sign({ id: "123456789012345678901234", role: "CUSTOMER" }, process.env.JWT_SECRET!);
    await request(app).get(`/api/orders/${id(0)}/admin-details`).set("Authorization", `Bearer ${customer}`).expect(403);
    await request(app).get(`/api/orders/${id(130)}/admin-details`).set(admin).expect(404);
    const publicOrder = await request(app).get(`/api/orders/${id(0)}`).expect(200);
    assert.equal(publicOrder.body.data.customerName, undefined);
    assert.equal(await integrity(), snapshot);
});
