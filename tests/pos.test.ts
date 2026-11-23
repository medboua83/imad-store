import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const name = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(name);
let p: any,
  app: any,
  owner: any,
  seller: any,
  other: any,
  reader: any,
  noAccess: any,
  category: any;
const token = (u: any) =>
  jwt.sign({ id: u.id, role: u.role, email: u.email, sv: u.authVersion }, process.env.JWT_SECRET!);
const auth = (u: any) => ({ Authorization: "Bearer " + token(u) });
const call = (path: string, u = seller) =>
  request(app)
    .get("/api/pos" + path)
    .set(auth(u));
async function product(stock = 20, extra: any = {}) {
  const suffix = randomBytes(6).toString("hex");
  return p.product.create({
    data: {
      slug: "pos-fixture-" + suffix,
      nameFr: "Article fictif",
      nameAr: "منتج تجريبي",
      nameEn: "Fixture",
      descriptionFr: "",
      descriptionAr: "",
      descriptionEn: "",
      price: 230,
      status: "ACTIVE",
      images: ["/images/catalogue-test/abaya.webp"],
      categoryId: category.id,
      ...extra,
      variants: {
        create: [
          {
            sku: "POS-" + suffix + "-M",
            size: "M",
            color: "#000000",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            stock,
          },
          {
            sku: "POS-" + suffix + "-L",
            size: "L",
            color: "#804000",
            colorNameFr: "Marron",
            colorNameAr: "بني",
            colorNameEn: "Brown",
            stock,
          },
        ],
      },
    },
    include: { variants: { orderBy: { size: "asc" } } },
  });
}
const items = (v: any, quantity = 1) => [{ variantId: v.id, quantity }];
async function quote(rows: any[], u = seller) {
  const r = await request(app)
    .post("/api/pos/quote")
    .set(auth(u))
    .send({ items: rows })
    .expect(200);
  return r.body.data;
}
const body = (q: any, extra: any = {}) => ({
  items: q.lines.map(({ variantId, quantity }: any) => ({ variantId, quantity })),
  quoteHash: q.quoteHash,
  paymentMethod: "CASH",
  receivedCents: q.totalCents,
  ...extra,
});
const sell = (data: any, key = randomUUID(), u = seller) =>
  request(app).post("/api/pos/sales").set(auth(u)).set("Idempotency-Key", key).send(data);
async function unchanged() {
  return JSON.stringify({
    orders: await p.order.findMany({ orderBy: { id: "asc" } }),
    outbox: await p.deskcommOutbox.count(),
    carrier: await p.olivraisonShipment.count(),
    events: await p.orderEvent.count(),
    notices: await p.adminNotification.count(),
  });
}
let initial: string;
before(async () => {
  await createDatabase(name);
  ({ prisma: p } = await import("../backend/src/lib/prisma"));
  ({ app } = await import("../backend/src/app"));
  const user = (label: string, role: string, permissions: string[] = []) =>
    p.user.create({
      data: {
        email: label + "@example.invalid",
        passwordHash: "fixture-no-login",
        firstName: label,
        lastName: "Fictif",
        role,
        permissions,
      },
    });
  owner = await user("owner", "ADMIN");
  seller = await user("cashier", "STAFF", ["pos.sell"]);
  other = await user("other", "STAFF", ["pos.sell"]);
  reader = await user("supervisor", "STAFF", ["pos.read"]);
  noAccess = await user("catalogue", "STAFF", ["catalogue.manage"]);
  category = await p.category.create({
    data: { slug: "pos-fixtures", nameFr: "Fictif", nameAr: "تجريبي", nameEn: "Fixture" },
  });
  await p.order.create({
    data: {
      customerName: "FICTIF",
      customerPhone: "+212600000099",
      city: "Rabat",
      status: "CANCELLED",
      paymentStatus: "PENDING",
      paymentMethod: "COD",
      totalAmount: 230,
      shippingCost: 30,
    },
  });
  initial = await unchanged();
});
after(async () => {
  await p?.$disconnect();
  await dropDatabase(name);
});

test("POS access and stored permissions protect catalogue, quotes, sales and receipts", async () => {
  await request(app).get("/api/pos/catalog").expect(401);
  for (const path of ["/context", "/catalog", "/sales", "/sales/" + "a".repeat(24)])
    await call(path, noAccess).expect(403);
  await request(app).post("/api/pos/quote").set(auth(reader)).send({ items: [] }).expect(403);
  await sell({}, randomUUID(), reader).expect(403);
  const ctx = (await call("/context")).body.data;
  assert.deepEqual(ctx, { actorId: seller.id, canSell: true, canReadAll: false });
  assert.equal((await call("/context", reader)).body.data.canReadAll, true);
  assert.equal(await unchanged(), initial);
});

test("Quotes combine repeated packs across sizes without reserving stock or creating web work", async () => {
  const productRow = await product(10, {
    quantityDiscounts: [{ minQuantity: 2, unitPrice: 200, totalPrice: 400 }],
  });
  const rows = items(productRow.variants[0], 2).concat(items(productRow.variants[1]));
  const q = await quote(rows);
  assert.equal(q.totalCents, 63000);
  assert.equal(q.savingsCents, 6000);
  assert.equal(
    q.lines.reduce((s: number, i: any) => s + i.totalCents, 0),
    63000,
  );
  assert.equal(await p.posSale.count(), 0);
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: productRow.variants[0].id } })).stock,
    10,
  );
  assert.equal(await unchanged(), initial);
  const cash = await sell(body(q, { receivedCents: 70000 })).expect(201);
  assert.equal(cash.body.data.changeCents, 7000);
  assert.equal(cash.body.data.cashierName, "cashier Fictif");
  assert.equal(cash.body.data.currency, "MAD");
  assert.equal(cash.body.data.items.length, 2);
  assert.equal("requestFingerprint" in cash.body.data, false);
  assert.equal("idempotencyKey" in cash.body.data, false);
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: productRow.variants[0].id } })).stock,
    8,
  );
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: productRow.variants[1].id } })).stock,
    9,
  );
  assert.equal(await unchanged(), initial);
});

test("An interrupted sale can be recovered and concurrently retried once even after price, stock or product status changes", async () => {
  const row = await product(1),
    v = row.variants[0],
    q = await quote(items(v)),
    key = randomUUID(),
    data = body(q);
  const responses = await Promise.all(Array.from({ length: 3 }, () => sell(data, key)));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 200, 201]);
  assert.equal(new Set(responses.map((r) => r.body.data.id)).size, 1);
  assert.equal(await p.posSale.count({ where: { idempotencyKey: key } }), 1);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 0);
  await p.product.update({
    where: { id: row.id },
    data: { price: 999, nameFr: "Modifié", status: "ARCHIVED" },
  });
  const replay = await sell(data, key).expect(200);
  assert.equal(replay.body.data.items[0].nameFr, "Article fictif");
  assert.equal(replay.body.data.totalCents, 23000);
  assert.equal((await call("/sales/by-key/" + key)).body.data.id, replay.body.data.id);
  await call("/sales/by-key/" + key, owner).expect(404);
  await call("/sales/" + replay.body.data.id, other).expect(404);
  await call("/sales/" + replay.body.data.id, reader).expect(200);
  await sell({ ...data, receivedCents: 24000 }, key).expect(409);
  await sell(data, key, other).expect(409);
  assert.equal(await unchanged(), initial);
});

test("A stale quote, unavailable variant or insufficient tender never partially changes stock", async () => {
  const row = await product(2),
    v = row.variants[0],
    q = await quote(items(v));
  await p.product.update({ where: { id: row.id }, data: { price: 250 } });
  await sell(body(q)).expect(409);
  const latest = await quote(items(v));
  await sell(body(latest, { receivedCents: 24999 })).expect(400);
  await sell(body(latest, { paymentMethod: "CARD_TERMINAL", receivedCents: 26000 })).expect(400);
  await sell({ ...body(latest), totalCents: 1 }).expect(400);
  await sell({ ...body(latest), items: [{ variantId: v.id, quantity: 1, price: 0.01 }] }).expect(
    400,
  );
  const count = await p.posSale.count();
  const both = await quote(row.variants.map((v: any) => ({ variantId: v.id, quantity: 1 })));
  await p.productVariant.update({ where: { id: row.variants[1].id }, data: { stock: 0 } });
  await sell(body(both)).expect(409);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 2);
  assert.equal(await p.posSale.count(), count);
  await p.productVariant.update({ where: { id: v.id }, data: { size: "40 41 42" } });
  await request(app)
    .post("/api/pos/quote")
    .set(auth(seller))
    .send({ items: items(v) })
    .expect(409);
});

test("Different concurrent sales compete for the final unit and card records do not invoke a payment gateway", async () => {
  const row = await product(1),
    v = row.variants[0],
    q = await quote(items(v));
  const rs = await Promise.all([
    sell(body(q, { paymentMethod: "CARD_TERMINAL" })),
    sell(body(q), randomUUID(), other),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 0);
  assert.equal(await unchanged(), initial);
});

test("The live web checkout and POS cannot both consume the last unit", async () => {
  const row = await product(1),
    v = row.variants[0],
    q = await quote(items(v));
  const website = {
    paymentMethod: "COD",
    crmConsent: false,
    aiServiceConsent: false,
    customer: {
      fullName: "TEST ISOLÉ",
      phone: "+212600000099",
      street: "Adresse fictive",
      city: "Rabat",
      region: "Rabat",
    },
    items: [{ productId: row.id, variantId: v.id, quantity: 1 }],
  };
  const rs = await Promise.all([
    sell(body(q)),
    request(app).post("/api/orders").set("Idempotency-Key", randomUUID()).send(website),
  ]);
  assert.equal(
    rs.filter((r) => r.status === 201).length,
    1,
    JSON.stringify(rs.map((r) => ({ status: r.status, error: r.body.error }))),
  );
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 0);
  // This one isolated web race deliberately creates at most one fictitious website order. Subsequent integrity checks start here.
  initial = await unchanged();
});

test("Receipt snapshots survive deletion of their original catalogue and enforce own-sales visibility", async () => {
  const row = await product(1),
    q = await quote(items(row.variants[0])),
    r = await sell(body(q)).expect(201),
    id = r.body.data.id;
  await p.productVariant.deleteMany({ where: { productId: row.id } });
  await p.product.delete({ where: { id: row.id } });
  assert.deepEqual((await call("/sales/" + id)).body.data, r.body.data);
  await call("/sales/" + id, other).expect(404);
  await call("/sales/" + id, reader).expect(200);
  await call("/sales?cashierId=" + other.id).expect(403);
  assert.equal(await unchanged(), initial);
});

test("Full-history pagination and cashier filters never expose another cashier through own-sales access", async () => {
  const make = async (u: any) =>
    p.posSale.create({
      data: {
        idempotencyKey: randomUUID(),
        requestFingerprint: "x",
        cashierId: u.id,
        cashierName: u.firstName,
        paymentMethod: "CASH",
        totalCents: 100,
        receivedCents: 100,
        changeCents: 0,
        savingsCents: 0,
        createdAt: new Date("2020-01-01T10:00:00Z"),
      },
    });
  for (let i = 0; i < 27; i++) await make(seller);
  const foreign = await make(other);
  const first = (await call("/sales")).body;
  assert.equal(first.data.length, 25);
  assert.equal(first.scope, "OWN");
  assert(first.data.every((s: any) => s.cashierId === seller.id));
  const second = (await call("/sales?page=2")).body;
  assert(second.data.length > 0);
  assert(second.data.every((s: any) => !first.data.some((a: any) => a.id === s.id)));
  const all = (await call("/sales?cashierId=" + other.id, reader)).body;
  assert.equal(all.scope, "ALL");
  assert(all.data.every((s: any) => s.cashierId === other.id));
  const found = (await call("/sales?search=POS-" + foreign.id.toUpperCase(), reader)).body;
  assert.equal(found.total, 1);
  assert.equal(found.data[0].id, foreign.id);
  assert.equal((await call("/sales?search=" + foreign.id)).body.total, 0);
  assert.equal((await call("/sales?search=%25", reader)).body.total, 0);
  await call("/sales?paymentStatus=PAID", reader).expect(400);
  assert.equal(await unchanged(), initial);
});

test("Removing sell access or changing the authentication version invalidates settlement at the server", async () => {
  const row = await product(1),
    q = await quote(items(row.variants[0])),
    old = token(seller),
    count = await p.posSale.count();
  const updated = await p.user.update({
    where: { id: seller.id },
    data: { permissions: [], authVersion: { increment: 1 } },
  });
  await request(app)
    .post("/api/pos/sales")
    .set("Authorization", "Bearer " + old)
    .set("Idempotency-Key", randomUUID())
    .send(body(q))
    .expect(401);
  await sell(body(q), randomUUID(), updated).expect(403);
  assert.equal(await p.posSale.count(), count);
  assert.equal((await p.productVariant.findUnique({ where: { id: row.variants[0].id } })).stock, 1);
});
