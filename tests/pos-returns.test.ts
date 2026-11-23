import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
const { databaseUrl, createDatabase, dropDatabase } = require("../scripts/test-postgres.cjs");
const name = "imad_ci_" + randomBytes(8).toString("hex");
process.env.DATABASE_URL = databaseUrl(name);
let p: any, app: any, category: any, reader: any, noAccess: any;
const token = (u: any) =>
  jwt.sign({ id: u.id, role: u.role, email: u.email, sv: u.authVersion }, process.env.JWT_SECRET!);
const auth = (u: any) => ({ Authorization: "Bearer " + token(u) });
const actor = (label: string, permissions = ["pos.sell", "pos.returns"]) =>
  p.user.create({
    data: {
      email: label + randomUUID() + "@example.invalid",
      passwordHash: "fixture-no-login",
      firstName: label,
      lastName: "Fictif",
      role: "STAFF",
      permissions,
    },
  });
const get = (u: any, path: string) =>
  request(app)
    .get("/api/pos/cash-sessions" + path)
    .set(auth(u));
const open = (u: any, openingCents = 10000, key = "open_" + randomUUID()) =>
  request(app)
    .post("/api/pos/cash-sessions/open")
    .set(auth(u))
    .set("Idempotency-Key", key)
    .send({ openingCents });
const close = (
  u: any,
  s: any,
  countedCents = s.expectedCents,
  note = "",
  key = "close_" + randomUUID(),
) =>
  request(app)
    .post("/api/pos/cash-sessions/close")
    .set(auth(u))
    .set("Idempotency-Key", key)
    .send({ sessionId: s.id, balanceHash: s.balanceHash, countedCents, note });
const state = async (u: any) => (await get(u, "/context").expect(200)).body.data;
const read = async (u: any, id: string) => (await get(u, "/" + id).expect(200)).body.data;
async function stock() {
  const row = await p.product.create({
    data: {
      slug: "cash-fixture-" + randomUUID(),
      nameFr: "Fictif",
      nameAr: "تجريبي",
      nameEn: "Fixture",
      descriptionFr: "",
      descriptionAr: "",
      descriptionEn: "",
      price: 230,
      status: "ACTIVE",
      images: [],
      categoryId: category.id,
      variants: {
        create: {
          sku: "CASH-" + randomUUID(),
          size: "M",
          color: "#000000",
          colorNameFr: "Noir",
          colorNameAr: "أسود",
          colorNameEn: "Black",
          stock: 20,
        },
      },
    },
    include: { variants: true },
  });
  return row.variants[0];
}
async function saleBody(u: any, v: any, sessionId?: string, paymentMethod = "CASH") {
  const q = (
    await request(app)
      .post("/api/pos/quote")
      .set(auth(u))
      .send({ items: [{ variantId: v.id, quantity: 1 }] })
      .expect(200)
  ).body.data;
  return {
    items: [{ variantId: v.id, quantity: 1 }],
    quoteHash: q.quoteHash,
    paymentMethod,
    receivedCents: paymentMethod === "CASH" ? 50000 : q.totalCents,
    ...(sessionId ? { cashSessionId: sessionId } : {}),
  };
}
const sale = (u: any, body: any, key = randomUUID()) =>
  request(app).post("/api/pos/sales").set(auth(u)).set("Idempotency-Key", key).send(body);
const untouched = async () =>
  JSON.stringify({
    orders: await p.order.findMany(),
    carrier: await p.olivraisonShipment.count(),
    outbox: await p.deskcommOutbox.count(),
    notices: await p.adminNotification.count(),
  });
let baseline: string;
before(async () => {
  await createDatabase(name);
  ({ prisma: p } = await import("../backend/src/lib/prisma"));
  ({ app } = await import("../backend/src/app"));
  category = await p.category.create({
    data: { slug: "cash-fixtures", nameFr: "Fictif", nameAr: "تجريبي", nameEn: "Fixture" },
  });
  reader = await actor("reader", ["pos.read"]);
  noAccess = await actor("no-access", []);
  baseline = await untouched();
});
after(async () => {
  await p?.$disconnect();
  await dropDatabase(name);
});

const ret = (u: any, b: any, key = randomUUID()) =>
  request(app).post("/api/pos/returns").set(auth(u)).set("Idempotency-Key", key).send(b);
const source = async (u: any, id: string, kind = "SALE") =>
  (await request(app).get("/api/pos/returns/source").set(auth(u)).query({ kind, id }).expect(200))
    .body.data;
const quoteReturn = async (u: any, b: any) =>
  (await request(app).post("/api/pos/returns/quote").set(auth(u)).send(b).expect(200)).body.data;
async function setup(quantity = 1, price = 230, sessionOpening = 100000) {
  const u = await actor("return"),
    v = await stock();
  await p.product.update({ where: { id: v.productId }, data: { price } });
  const s = (await open(u, sessionOpening).expect(201)).body.data;
  const q = (
    await request(app)
      .post("/api/pos/quote")
      .set(auth(u))
      .send({ items: [{ variantId: v.id, quantity }] })
      .expect(200)
  ).body.data;
  const receipt = (
    await sale(u, {
      items: [{ variantId: v.id, quantity }],
      quoteHash: q.quoteHash,
      paymentMethod: "CASH",
      receivedCents: q.totalCents,
      cashSessionId: s.id,
    }).expect(201)
  ).body.data;
  return { u, v, s, receipt };
}
async function body(
  u: any,
  s: any,
  receipt: any,
  quantity = 1,
  restock = true,
  replacements: any[] = [],
  kind = "SALE",
) {
  const request = {
    sourceKind: kind,
    sourceId: receipt.id,
    returns: [
      {
        itemId: receipt.items.find((i: any) => !i.kind || i.kind === "REPLACEMENT").id,
        quantity,
        restock,
      },
    ],
    replacements,
  };
  const q = await quoteReturn(u, request);
  return {
    ...request,
    quoteHash: q.quoteHash,
    cashSessionId: s.id,
    paymentMethod: q.netCents < 0 ? "CASH" : q.netCents === 0 ? "NONE" : "CASH",
    receivedCents: Math.max(0, q.netCents),
    note: "Retour fictif isolé",
  };
}

test("Partial discounted returns preserve original paid cents, require condition, and never over-refund", async () => {
  const { u, v, s, receipt } = await setup(3, 0.01);
  // Three items cost one cent each; a discounted line snapshot carries only two paid cents.
  await p.posSaleItem.update({ where: { id: receipt.items[0].id }, data: { totalCents: 2 } });
  const snapshot = JSON.stringify(
    await p.posSale.findUnique({ where: { id: receipt.id }, include: { items: true } }),
  );
  const amounts = [];
  for (let n = 0; n < 3; n++) {
    const b = await body(u, s, receipt),
      r = (await ret(u, b).expect(201)).body.data;
    amounts.push(r.returnCents);
  }
  assert.deepEqual(amounts, [0, 1, 1]);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 20);
  assert.equal((await source(u, receipt.id)).items[0].remainingQuantity, 0);
  await request(app)
    .post("/api/pos/returns/quote")
    .set(auth(u))
    .send({
      sourceKind: "SALE",
      sourceId: receipt.id,
      returns: [{ itemId: receipt.items[0].id, quantity: 1, restock: true }],
      replacements: [],
    })
    .expect(409);
  assert.equal(
    JSON.stringify(
      await p.posSale.findUnique({ where: { id: receipt.id }, include: { items: true } }),
    ),
    snapshot,
  );
  assert.equal(await untouched(), baseline);
});

test("Same-key retries after a lost response create one refund and one restock, even after closing", async () => {
  const { u, v, s, receipt } = await setup(),
    b = await body(u, s, receipt),
    key = randomUUID();
  await p.product.update({ where: { id: v.productId }, data: { price: 900 } });
  const responses = await Promise.all([ret(u, b, key), ret(u, b, key)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
  const r = responses[0].body.data;
  assert.equal(r.returnCents, 23000);
  assert.equal(r.netCents, -23000);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 20);
  const c = (await state(u)).active;
  assert.equal(c.expectedCents, 100000);
  assert.equal(c.adjustmentCents, -23000);
  await close(u, c).expect(201);
  await open(u, 0).expect(201);
  assert.equal((await ret(u, b, key).expect(200)).body.data.id, r.id);
  assert.equal(
    (
      await request(app)
        .get("/api/pos/returns/by-key/" + key)
        .set(auth(u))
        .expect(200)
    ).body.data.id,
    r.id,
  );
  await ret(u, { ...b, note: "Autre motif" }, key).expect(409);
  assert.equal(await p.posAdjustment.count({ where: { idempotencyKey: key } }), 1);
  assert.equal(await untouched(), baseline);
});

test("Different attempts racing for the same final unit cannot refund or restore it twice", async () => {
  const { u, v, s, receipt } = await setup(),
    b = await body(u, s, receipt);
  const r = await Promise.all([ret(u, b), ret(u, b)]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 20);
  assert.equal(await p.posAdjustment.count({ where: { sourceSaleId: receipt.id } }), 1);
});

test("Exchanges use resellable returns atomically when stock is empty; replacement can subsequently be returned", async () => {
  const { u, v, s, receipt } = await setup();
  await p.productVariant.update({ where: { id: v.id }, data: { stock: 0 } });
  const b = await body(u, s, receipt, 1, true, [{ variantId: v.id, quantity: 1 }]);
  const r = (await ret(u, b).expect(201)).body.data;
  assert.equal(r.netCents, 0);
  assert.equal(r.paymentMethod, "NONE");
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 0);
  assert.equal(await p.posSale.count({ where: { cashierId: u.id } }), 1);
  const b2 = await body(u, s, r, 1, true, [], "EXCHANGE"),
    returned = (await ret(u, b2).expect(201)).body.data;
  assert.equal(returned.returnCents, 23000);
  assert.equal(returned.rootSaleId, receipt.id);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 1);
  assert.equal((await state(u)).active.expectedCents, 100000);
  assert.equal(await untouched(), baseline);
});

test("Cash and external-card exchange differences are recorded without fake gross sales", async () => {
  const { u, v, s, receipt } = await setup();
  const replacement = await stock();
  await p.product.update({ where: { id: replacement.productId }, data: { price: 300 } });
  const b = await body(u, s, receipt, 1, false, [{ variantId: replacement.id, quantity: 1 }]);
  b.receivedCents = 10000;
  const r = (await ret(u, b).expect(201)).body.data;
  assert.equal(r.netCents, 7000);
  assert.equal(r.changeCents, 3000);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 19);
  assert.equal((await p.productVariant.findUnique({ where: { id: replacement.id } })).stock, 19);
  const c = (await state(u)).active;
  assert.equal(c.cashCents, 23000);
  assert.equal(c.adjustmentCents, 7000);
  assert.equal(c.expectedCents, 130000);
  const next = await setup(),
    v2 = await stock();
  await p.product.update({ where: { id: v2.productId }, data: { price: 300 } });
  const b2 = await body(next.u, next.s, next.receipt, 1, true, [{ variantId: v2.id, quantity: 1 }]);
  b2.paymentMethod = "CARD_TERMINAL";
  await ret(next.u, b2).expect(201);
  const c2 = (await state(next.u)).active;
  assert.equal(c2.expectedCents, 123000);
  assert.equal(c2.cardAdjustmentCents, 7000);
  assert.equal(await untouched(), baseline);
});

test("Condition is mandatory and changed or missing variants are never silently restocked", async () => {
  const { u, v, s, receipt } = await setup();
  const b = await body(u, s, receipt),
    bad = structuredClone(b);
  delete bad.returns[0].restock;
  await ret(u, bad).expect(400);
  await p.productVariant.update({ where: { id: v.id }, data: { size: "OTHER" } });
  assert.equal((await source(u, receipt.id)).items[0].canRestock, false);
  await ret(u, b).expect(409);
  const nonrestock = await body(u, s, receipt, 1, false);
  await ret(u, nonrestock).expect(201);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 19);
  const next = await setup();
  await p.productVariant.delete({ where: { id: next.v.id } });
  await ret(next.u, await body(next.u, next.s, next.receipt, 1, false)).expect(201);
  assert.equal(await untouched(), baseline);
});

test("Refunds require available cash in the current personal session and do not rewrite an old closing", async () => {
  const { u, v, s, receipt } = await setup();
  const closed = (await close(u, (await state(u)).active).expect(201)).body.data;
  const next = (await open(u, 0).expect(201)).body.data;
  const b = await body(u, next, receipt);
  await ret(u, b).expect(409);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 19);
  await close(u, next).expect(201);
  const funded = (await open(u, 30000).expect(201)).body.data;
  await ret(u, await body(u, funded, receipt)).expect(201);
  assert.equal((await state(u)).active.expectedCents, 7000);
  assert.deepEqual(await read(u, s.id), closed);
});

test("A stale count and an older closing implementation cannot omit refunds", async () => {
  const { u, s, receipt } = await setup(),
    before = (await state(u)).active;
  await ret(u, await body(u, s, receipt)).expect(201);
  await close(u, before).expect(409);
  const c = (await state(u)).active;
  await assert.rejects(() =>
    p.posCashClosing.create({
      data: {
        sessionId: s.id,
        closeKey: "close_" + randomUUID(),
        requestFingerprint: "old-client",
        countedCents: before.expectedCents,
        cashCents: BigInt(before.cashCents),
        cardCents: 0n,
        cashCount: 1,
        cardCount: 0,
        expectedCents: BigInt(before.expectedCents),
        differenceCents: 0n,
        note: "",
      },
    }),
  );
  const closed = (await close(u, c).expect(201)).body.data;
  assert.equal(closed.adjustmentCents, -23000);
  assert.equal(closed.adjustmentCount, 1);
  assert.equal(closed.expectedCents, 100000);
});

test("Closing versus return concurrency either includes the refund or rejects without stock effects", async () => {
  const { u, v, s, receipt } = await setup(),
    b = await body(u, s, receipt),
    c = (await state(u)).active;
  const [closing, returning] = await Promise.all([close(u, c), ret(u, b)]);
  assert.deepEqual([closing.status, returning.status].sort(), [201, 409]);
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: v.id } })).stock,
    returning.status === 201 ? 20 : 19,
  );
  if (closing.status !== 201) await close(u, (await state(u)).active).expect(201);
  assert.equal((await read(u, s.id)).adjustmentCount, returning.status === 201 ? 1 : 0);
});

test("Dedicated permission, source ownership, receipt recovery and revoked accounts are enforced", async () => {
  const { u, s, receipt } = await setup(),
    b = await body(u, s, receipt),
    seller = await actor("sell-only", ["pos.sell"]),
    other = await actor("other-returner");
  await ret(seller, b).expect(403);
  await ret(reader, b).expect(403);
  await ret(noAccess, b).expect(403);
  await request(app)
    .get("/api/pos/returns/source")
    .set(auth(other))
    .query({ kind: "SALE", id: receipt.id })
    .expect(404);
  const key = randomUUID(),
    r = (await ret(u, b, key).expect(201)).body.data;
  await request(app)
    .get("/api/pos/returns/" + r.id)
    .set(auth(other))
    .expect(404);
  await request(app)
    .get("/api/pos/returns/" + r.id)
    .set(auth(reader))
    .expect(200);
  await request(app)
    .get("/api/pos/returns/by-key/" + key)
    .set(auth(other))
    .expect(404);
  assert.equal(
    (await request(app).get("/api/pos/returns").set(auth(other)).expect(200)).body.total,
    0,
  );
  const { completeReturn } = await import("../backend/src/lib/pos-returns");
  const staleActor = { ...u, authVersion: u.authVersion };
  await p.user.update({
    where: { id: u.id },
    data: { permissions: ["pos.sell"], authVersion: { increment: 1 } },
  });
  await assert.rejects(
    () => completeReturn(staleActor, key, b),
    (e: any) => e.status === 403,
  );
});

test("Stale replacement prices and invalid settlement do not cause partial refunds or stock movements", async () => {
  const { u, v, s, receipt } = await setup(),
    rep = await stock();
  const b = await body(u, s, receipt, 1, true, [{ variantId: rep.id, quantity: 1 }]);
  await p.product.update({ where: { id: rep.productId }, data: { price: 500 } });
  await ret(u, b).expect(409);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 19);
  assert.equal((await p.productVariant.findUnique({ where: { id: rep.id } })).stock, 20);
  const b2 = await body(u, s, receipt);
  await ret(u, { ...b2, paymentMethod: "CARD_TERMINAL" }).expect(400);
  await ret(u, { ...b2, receivedCents: 1 }).expect(400);
  assert.equal(await p.posAdjustment.count({ where: { sourceSaleId: receipt.id } }), 0);
  assert.equal(await untouched(), baseline);
});

test("Two authorized cashiers cannot return the same source unit into different registers", async () => {
  const { u, v, s, receipt } = await setup(),
    other = await actor("global-return", ["pos.sell", "pos.returns", "pos.read"]),
    s2 = (await open(other, 100000).expect(201)).body.data;
  const b = await body(u, s, receipt),
    b2 = await body(other, s2, receipt);
  const rows = await Promise.all([ret(u, b), ret(other, b2)]);
  assert.deepEqual(rows.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 20);
  assert.equal(await p.posAdjustment.count({ where: { sourceSaleId: receipt.id } }), 1);
  assert.equal(
    (await state(u)).active.expectedCents + (await state(other)).active.expectedCents,
    200000,
  );
});
