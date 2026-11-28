import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import { orderTrackingMatches, orderTrackingFilters } from "@imad-store/shared";
import { Prisma } from "@prisma/client";
import { orderDay } from "../apps/web/app/admin/order-utils";
import { moroccoDayBoundary, orderHistoryQuery, orderHistoryWhere } from "../backend/src/lib/order-history-query";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const database = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(database);
process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = "false";
let p: any, app: any, snapshot: string;
const trackingCases = [
    { state: "ACTIVE", carrierStatus: "REPORTED", lastError: null },
    { state: "ACTIVE", carrierStatus: "TRANSIT", lastError: null },
    null,
    { state: "ACTIVE", carrierStatus: "UNKNOWN_CALL", lastError: null },
    { state: "RETRY", carrierStatus: "TRANSIT", lastError: "Erreur de recette" },
    { state: "ATTENTION", carrierStatus: "CREATED", lastError: null },
    { state: "DISCONNECTED", carrierStatus: "DELIVERED", lastError: null },
    { state: "ACTIVE", carrierStatus: "FUTURE_PARTNER_CODE", lastError: null },
    { state: "DONE", carrierStatus: "DELIVERED", lastError: null },
    { state: "DONE", carrierStatus: "ARCHIVED", lastError: null },
    { state: "DONE", carrierStatus: "RETURNED", lastError: null },
    { state: "QUEUED", carrierStatus: null, lastError: null },
    { state: "ACTIVE", carrierStatus: "CANCELLED", lastError: null },
    { state: "ACTIVE", carrierStatus: "CREATED", lastError: "Erreur de lecture" },
];
const shipmentFor = (n: number) => trackingCases[n % trackingCases.length];
const expectedAttention = new Set([0, 3, 4, 5, 6, 7, 10, 12, 13]);
const admin = { Authorization: `Bearer ${jwt.sign({ id: "123456789012345678901234", role: "ADMIN" }, process.env.JWT_SECRET!)}` };
// Keep zeroes in the counter only: otherwise a prefix ending in 0 makes
// #00000000 match the first 16 IDs across the prefix/counter boundary.
const prefix = randomBytes(8).toString("hex").replaceAll("0", "a");
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
        shipments: await p.olivraisonShipment.findMany({ orderBy: { id: "asc" } }), events: await p.orderEvent.count(),
    });
}
before(async () => {
    await createDatabase(database);
    ({ prisma: p } = await import("../backend/src/lib/prisma"));
    await p.user.upsert({ where: { id: "123456789012345678901234" }, create: { id: "123456789012345678901234", email: "fixture-admin@example.invalid", passwordHash: "fixture-no-login", firstName: "Test", lastName: "Admin", role: "ADMIN" }, update: {} });
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
    await p.olivraisonShipment.createMany({ data: rows.flatMap((row, n) => {
        const shipment = shipmentFor(n);
        return shipment ? [{ id: row.id, trackingId: "FICTIF-" + n, ...shipment }] : [];
    }) });
    await p.olivraisonShipment.create({ data: { id: id(130), trackingId: "TRASH-FICTIF", state: "ACTIVE", carrierStatus: "REPORTED" } });
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


test("Tracking views agree between local summaries and the server across the complete history", async () => {
    for (const filter of orderTrackingFilters) {
        const expected = rows.filter((_, n) => filter === "ALL" || filter === "UNLINKED" && !shipmentFor(n)
            || filter === "REPORTED" && n % trackingCases.length === 0
            || filter === "ATTENTION" && expectedAttention.has(n % trackingCases.length));
        assert.deepEqual(rows.filter((_, n) => orderTrackingMatches(shipmentFor(n), filter)).map(row => row.id), expected.map(row => row.id));
        const all: string[] = [];
        for (let page = 1; page <= Math.max(1, Math.ceil(expected.length / 25)); page++) {
            const r = await get({ search: "HISTORY-" + prefix, tracking: filter, limit: 25, page });
            assert.equal(r.body.trackingFilter, filter);
            assert.equal(r.body.total, expected.length);
            assert.equal(r.body.scopeTotal, expected.length);
            assert.equal(Object.values(r.body.statusCounts).reduce((a: number, b: any) => a + Number(b), 0), expected.length);
            all.push(...r.body.data.map((row: any) => row.id));
        }
        assert.deepEqual(all.sort(), expected.map(row => row.id).sort());
        assert.equal(new Set(all).size, all.length);
    }
    const found = await get({ search: "Mariam", tracking: "REPORTED" });
    assert.equal(found.body.total, 1); assert.equal(found.body.data[0].id, id(0));
    const paid = rows.filter((row, n) => row.paymentStatus === "PAID" && expectedAttention.has(n % trackingCases.length));
    const r = await get({ search: "HISTORY-" + prefix, tracking: "ATTENTION", payment: "PAID", status: "SHIPPED" });
    assert.equal(r.body.scopeTotal, paid.length);
    assert.equal(r.body.total, paid.filter(row => row.status === "SHIPPED").length);
    assert.equal((await get({ trash: "true", tracking: "REPORTED" })).body.total, 1);
    assert.equal(await integrity(), snapshot);
});

test("Unknown tracking filters and unauthorized callers cannot access or change tracking records", async () => {
    for (const tracking of ["wrong", "ATTENTION' OR 1=1--", ["REPORTED", "ALL"]]) {
        await request(app).get("/api/orders").query({ tracking }).set(admin).expect(400);
    }
    await request(app).get("/api/orders").query({ tracking: "ATTENTION" }).expect(401);
    const token = jwt.sign({ id: "123456789012345678901234", role: "CUSTOMER" }, process.env.JWT_SECRET!);
    await request(app).get("/api/orders").query({ tracking: "ATTENTION" }).set("Authorization", `Bearer ${token}`).expect(403);
    assert.equal(orderTrackingMatches(shipmentFor(0), "wrong"), false);
    assert.equal(await integrity(), snapshot);
});

// Parse quoted CSV, including multiline cells, independently of the serializer.
function parseCsv(text: string) {
    const records: string[][] = []; let row: string[] = [], cell = "", quoted = false;
    for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
            else quoted = !quoted;
        } else if (!quoted && (c === ";" || c === "\r" || c === "\n")) {
            row.push(cell); cell = "";
            if (c !== ";") { records.push(row); row = []; if (c === "\r" && text[i + 1] === "\n") i++; }
        } else cell += c;
    }
    assert.equal(quoted, false);
    return records;
}
const csv = (q: Record<string, string | number> = {}) => request(app).get("/api/orders/export.csv").query(q).set(admin);

test("CSV exports every matching history page in stable order, with all active filters", async () => {
    for (const q of [
        { search: "HISTORY-" + prefix, sort: "oldest" },
        { search: "HISTORY-" + prefix, tracking: "ATTENTION", status: "SHIPPED", payment: "PENDING", sort: "amount" },
        { search: "HISTORY-" + prefix, tracking: "REPORTED" },
        { search: "HISTORY-" + prefix, tracking: "UNLINKED" },
        { search: "Projected day", from: "2026-11-22", to: "2026-11-22" },
        { search: "#" + id(0).slice(-8) },
        { search: "Aucun résultat fictif" },
    ]) {
        const query = q as Record<string, string>;
        const expected: string[] = [];
        const first = await get({ ...query, limit: 100 });
        expected.push(...first.body.data.map((o: any) => o.id));
        if (first.body.totalPages > 1) expected.push(...(await get({ ...query, limit: 100, page: 2 })).body.data.map((o: any) => o.id));
        const r = await csv(query).expect(200);
        assert.match(r.headers["content-type"], /^text\/csv; charset=utf-8/);
        assert.match(r.headers["content-disposition"], /^attachment; filename="imad-commandes-\d{4}-\d{2}-\d{2}\.csv"$/);
        assert.match(r.headers["cache-control"], /private.*no-store/);
        assert.equal(r.text.charCodeAt(0), 0xfeff);
        const parsed = parseCsv(r.text);
        assert.equal(parsed.length - 1, first.body.total);
        assert.equal(Number(r.headers["x-order-export-count"]), first.body.total);
        assert.deepEqual(parsed.slice(1).map(row => row[1].replace(/^'/, "")), expected);
        assert.equal(new Set(expected).size, expected.length);
        assert.ok(!parsed.slice(1).some(row => row[1] === "'" + id(130)));
        for (const row of parsed.slice(1)) {
            assert.equal(row.length, 32); assert.equal(row[13], "MAD");
            assert.deepEqual(row.slice(19), Array(13).fill(""), "old orders have no invented campaign attribution");
        }
    }
    assert.equal(await integrity(), snapshot);
});

test("CSV preserves Unicode, quotes, amounts and payment while neutralizing spreadsheet formulas", async () => {
    const { csvCell } = await import("../backend/src/lib/order-export");
    assert.equal(parseCsv(csvCell("001234567890123456789012", true) + '\r\n')[0][0], "'001234567890123456789012");
    for (const value of ['=1+1', '  =HYPERLINK("a";"b")', '+212600000000', '-1+2', '@SUM(1)', '\t\r=1', '\u200f=1', '\u0000=1'])
        assert.ok(parseCsv(csvCell(value) + '\r\n')[0][0].startsWith("'"), value);
    const variant = await p.productVariant.findFirst();
    const special = await p.order.create({ data: {
        ...rows[1], id: id(160), customerName: '  =HYPERLINK("https://example.test";"bad")',
        fullName: 'زبون تجريبي', street: 'Rue "test";\nعنوان تجريبي', customerEmail: 'test@example.test',
        idempotencyKey: 'PRIVATE-NOT-IN-CSV', requestFingerprint: 'PRIVATE-FINGERPRINT',
        items: { create: { productId: variant.productId, variantId: variant.id, quantity: 2, unitPrice: 100 } },
    } });
    try {
        const before = await integrity();
        const r = await csv({ search: id(160), locale: "ar" }).expect(200);
        const records = parseCsv(r.text), row = records[1];
        assert.equal(records[0][0], "المرجع");
        assert.equal(row[3], "'" + special.customerName);
        assert.equal(row[7], special.street);
        assert.equal(row[9], "PAID"); assert.equal(row[11], "201.00"); assert.equal(row[12], "30.00");
        assert.match(row[14], /2 × 100.00 MAD/); assert.match(row[14], /HISTORY-TEST/);
        assert.doesNotMatch(r.text, /PRIVATE-NOT-IN-CSV|PRIVATE-FINGERPRINT|requestFingerprint|idempotencyKey/);
        assert.equal(await integrity(), before);
    } finally { await p.orderItem.deleteMany({ where: { orderId: id(160) } }); await p.order.delete({ where: { id: id(160) } }); }
    assert.equal(await integrity(), snapshot);
});

test("CSV requires administrator access and refuses unknown parameters or invalid filters", async () => {
    await request(app).get("/api/orders/export.csv").expect(401);
    const token = jwt.sign({ id: "123456789012345678901234", role: "CUSTOMER" }, process.env.JWT_SECRET!);
    await request(app).get("/api/orders/export.csv").set("Authorization", `Bearer ${token}`).expect(403);
    for (const q of [{ trash: "true" }, { page: 2 }, { limit: 25 }, { status: "bad" }, { tracking: "bad" },
        { locale: "wrong" }, { from: "2026-02-31" }, { from: "2026-11-23", to: "2026-11-22" }, { search: ["a", "b"] }]) {
        const r = await csv(q as any).expect(400);
        assert.doesNotMatch(r.headers["content-type"], /csv/);
    }
    assert.equal((parseCsv((await csv({ search: "%' OR 1=1--" }).expect(200)).text)).length, 1);
    assert.equal(await integrity(), snapshot);
});

test("An oversized CSV is refused entirely instead of silently truncating the history", { timeout: 30000 }, async () => {
    const label = "EXPORT-LIMIT-" + prefix;
    await p.order.createMany({ data: Array.from({ length: 10001 }, (_, n) => ({
        ...rows[0], id: id(n + 100000), customerName: label, status: n === 10000 ? "CONFIRMED" : "PENDING",
    })) });
    try {
        const before = await integrity();
        const r = await csv({ search: label }).expect(422);
        assert.equal(r.body.error, "ORDER_EXPORT_TOO_LARGE");
        assert.equal(r.headers["content-disposition"], undefined);
        const boundary = await csv({ search: label, status: "PENDING" }).expect(200);
        assert.equal(boundary.headers["x-order-export-count"], "10000");
        assert.equal(parseCsv(boundary.text).length, 10001);
        assert.equal(await integrity(), before);
    } finally { await p.order.deleteMany({ where: { customerName: label } }); }
    assert.equal(await integrity(), snapshot);
});
