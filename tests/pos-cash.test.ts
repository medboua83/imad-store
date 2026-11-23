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
const actor = (label: string, permissions = ["pos.sell"]) =>
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

test("Sessions opt in per cashier, preserve legacy receipts and deduplicate opening attempts", async () => {
  const u = await actor("opening"),
    other = await actor("other"),
    v = await stock();
  assert.deepEqual(await state(u), { enabled: false, active: null });
  const legacy = (await sale(u, await saleBody(u, v)).expect(201)).body.data;
  assert.equal(legacy.cashSessionId, null);
  const key = "open_" + randomUUID(),
    opened = await Promise.all([open(u, 10000, key), open(u, 10000, key)]);
  assert.deepEqual(opened.map((r) => r.status).sort(), [200, 201]);
  assert.equal(opened[0].body.data.id, opened[1].body.data.id);
  const s = opened[0].body.data;
  assert.equal(s.openingCents, 10000);
  assert.equal(s.cashCount, 0);
  assert.equal(s.expectedCents, 10000);
  await open(u, 10001, key).expect(409);
  await open(other, 10000, key).expect(409);
  await open(u).expect(409);
  await get(other, "/attempt/" + key).expect(404);
  assert.equal((await get(u, "/attempt/" + key).expect(200)).body.data.id, s.id);
  assert.equal((await p.posSale.findUnique({ where: { id: legacy.id } })).cashSessionId, null);
  assert.equal(await untouched(), baseline);
});

test("Closing counts net cash only, stores immutable totals and deduplicates retries after later openings", async () => {
  const u = await actor("closing"),
    v = await stock(),
    openKey = "open_" + randomUUID(),
    s = (await open(u, 20000, openKey).expect(201)).body.data;
  const cashKey = randomUUID(),
    cashBody = await saleBody(u, v, s.id);
  const receipt = (await sale(u, cashBody, cashKey).expect(201)).body.data;
  assert.equal(receipt.changeCents, 27000);
  assert.equal(receipt.cashSessionId, s.id);
  await sale(u, await saleBody(u, v, s.id, "CARD_TERMINAL")).expect(201);
  const current = (await state(u)).active;
  assert.equal(current.cashCents, 23000);
  assert.equal(current.cardCents, 23000);
  assert.equal(current.expectedCents, 43000);
  const before = JSON.stringify({
    sales: await p.posSale.findMany({ orderBy: { id: "asc" } }),
    variants: await p.productVariant.findMany({ orderBy: { id: "asc" } }),
  });
  const key = "close_" + randomUUID(),
    r = await Promise.all([close(u, current, 43000, "", key), close(u, current, 43000, "", key)]);
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 201]);
  assert.equal(r[0].body.data.closing.differenceCents, 0);
  assert.deepEqual(await state(u), { enabled: true, active: null });
  assert.equal((await read(reader, s.id)).closing.countedCents, 43000);
  await close(u, current, 43001, "écart", key).expect(409);
  await close(u, current, 43000).expect(409);
  assert.equal(await p.posCashClosing.count({ where: { sessionId: s.id } }), 1);
  const closed = await read(u, s.id);
  const next = (await open(u, 5000).expect(201)).body.data;
  assert.equal((await open(u, 20000, openKey).expect(200)).body.data.id, s.id);
  assert.equal((await state(u)).active.id, next.id);
  assert.deepEqual((await close(u, current, 43000, "", key).expect(200)).body.data, closed);
  assert.equal((await sale(u, cashBody, cashKey).expect(200)).body.data.id, receipt.id);
  await sale(u, cashBody).expect(409);
  assert.equal(
    JSON.stringify({
      sales: await p.posSale.findMany({ orderBy: { id: "asc" } }),
      variants: await p.productVariant.findMany({ orderBy: { id: "asc" } }),
    }),
    before,
  );
  assert.equal(await untouched(), baseline);
});

test("A stale count cannot close over new sales, and a discrepancy requires an explanation", async () => {
  const u = await actor("variance"),
    v = await stock(),
    s = (await open(u, 10000).expect(201)).body.data;
  await sale(u, await saleBody(u, v, s.id)).expect(201);
  await close(u, s).expect(409);
  const current = (await state(u)).active;
  await close(u, current, 32000).expect(400);
  await close(u, current, 32000, "😀😀").expect(400);
  assert.equal(await p.posCashClosing.count({ where: { sessionId: s.id } }), 0);
  const closed = (await close(u, current, 32000, "Erreur de comptage déclarée").expect(201)).body
    .data;
  assert.equal(closed.closing.differenceCents, -1000);
  assert.equal(closed.closing.countedCents, 32000);
  assert.equal(closed.expectedCents, 33000);
  const other = await actor("surplus"),
    s2 = (await open(other, 0).expect(201)).body.data;
  assert.equal(
    (await close(other, s2, 100, "Excédent déclaré").expect(201)).body.data.closing.differenceCents,
    100,
  );
  assert.equal(await untouched(), baseline);
});

test("Sale versus closing concurrency either includes the sale or rejects it without partial stock changes", async () => {
  const u = await actor("race"),
    v = await stock(),
    s = (await open(u, 10000).expect(201)).body.data,
    body = await saleBody(u, v, s.id);
  const [closing, selling] = await Promise.all([close(u, s), sale(u, body)]);
  assert.deepEqual([closing.status, selling.status].sort(), [201, 409]);
  const sales = await p.posSale.findMany({ where: { cashSessionId: s.id } });
  assert.equal(sales.length, selling.status === 201 ? 1 : 0);
  assert.equal(
    (await p.productVariant.findUnique({ where: { id: v.id } })).stock,
    20 - sales.length,
  );
  const current = await state(u);
  if (closing.status === 201) {
    assert.equal(current.active, null);
    assert.equal((await read(u, s.id)).cashCents, 0);
  } else {
    assert.equal(current.active.cashCents, 23000);
    await close(u, current.active).expect(201);
  }
  assert.equal(await untouched(), baseline);
});

test("An opted-in cashier cannot bypass a session with missing, foreign or closed identifiers, including an old application insert", async () => {
  const u = await actor("guard"),
    other = await actor("foreign"),
    v = await stock(),
    s = (await open(u).expect(201)).body.data,
    s2 = (await open(other).expect(201)).body.data;
  await sale(u, await saleBody(u, v)).expect(409);
  await sale(u, await saleBody(u, v, s2.id)).expect(409);
  const fields = {
    idempotencyKey: randomUUID(),
    requestFingerprint: "old-application",
    cashierId: u.id,
    cashierName: "Fixture",
    paymentMethod: "CASH",
    totalCents: 100,
    receivedCents: 100,
    changeCents: 0,
    savingsCents: 0,
  };
  await assert.rejects(() => p.posSale.create({ data: fields }));
  await assert.rejects(() =>
    p.posSale.create({ data: { ...fields, idempotencyKey: randomUUID(), cashSessionId: s2.id } }),
  );
  await close(u, s).expect(201);
  await sale(u, await saleBody(u, v, s.id)).expect(409);
  assert.equal((await p.productVariant.findUnique({ where: { id: v.id } })).stock, 20);
  assert.equal(await p.posSale.count({ where: { cashierId: u.id } }), 0);
  assert.equal(await untouched(), baseline);
});

test("Session permissions, private reports, invalid amounts and revoked accounts remain enforced", async () => {
  const u = await actor("permissions"),
    other = await actor("hidden"),
    s = (await open(u).expect(201)).body.data;
  await request(app).get("/api/pos/cash-sessions/context").expect(401);
  await get(noAccess, "").expect(403);
  await open(reader).expect(403);
  await close(reader, s).expect(403);
  await get(other, "/" + s.id).expect(404);
  await get(reader, "/" + s.id).expect(200);
  for (const openingCents of [-1, 0.1, 2_000_000_001]) await open(other, openingCents).expect(400);
  await request(app)
    .post("/api/pos/cash-sessions/open")
    .set(auth(other))
    .set("Idempotency-Key", "close_" + randomUUID())
    .send({ openingCents: 0 })
    .expect(400);
  await request(app)
    .post("/api/pos/cash-sessions/close")
    .set(auth(u))
    .set("Idempotency-Key", "close_" + randomUUID())
    .send({
      sessionId: s.id,
      balanceHash: s.balanceHash,
      countedCents: 10000,
      note: "",
      expectedCents: 0,
    })
    .expect(400);
  const fresh = await actor("revoked");
  const { openCashSession } = await import("../backend/src/lib/pos-cash");
  await p.user.update({
    where: { id: fresh.id },
    data: { permissions: [], authVersion: { increment: 1 } },
  });
  await assert.rejects(
    () => openCashSession(fresh, "open_" + randomUUID(), { openingCents: 0 }),
    (e: any) => e.status === 403,
  );
  assert.equal(await p.posCashRegister.count({ where: { cashierId: fresh.id } }), 0);
  assert.equal(await untouched(), baseline);
});

test("Session history is fully paginated and scoped, including closing snapshots after account renaming", async () => {
  const u = await actor("history"),
    other = await actor("elsewhere");
  let last: any;
  for (let i = 0; i < 27; i++)
    last = await p.posCashSession.create({
      data: {
        openKey: "open_" + randomUUID(),
        requestFingerprint: "fixture",
        cashierId: u.id,
        cashierName: "Identité enregistrée",
        openingCents: 100,
        openedAt: new Date("2020-01-01T10:00:00Z"),
        closing: {
          create: {
            closeKey: "close_" + randomUUID(),
            requestFingerprint: "fixture",
            countedCents: 100,
            cashCents: 0n,
            cardCents: 0n,
            cashCount: 0,
            cardCount: 0,
            expectedCents: 100n,
            differenceCents: 0n,
            note: "",
          },
        },
      },
    });
  const foreign = (await open(other).expect(201)).body.data;
  const first = (await get(u, "").expect(200)).body,
    second = (await get(u, "?page=2").expect(200)).body;
  assert.equal(first.scope, "OWN");
  assert.equal(first.total, 27);
  assert.equal(first.data.length, 25);
  assert.equal(second.data.length, 2);
  assert(first.data.every((s: any) => s.cashierId === u.id));
  assert(second.data.every((s: any) => !first.data.some((r: any) => r.id === s.id)));
  assert.equal((await get(u, "?page=999").expect(200)).body.page, 2);
  await get(u, "?cashierId=" + other.id).expect(400);
  assert((await get(reader, "").expect(200)).body.total > 27);
  await get(u, "/" + foreign.id).expect(404);
  await p.user.update({ where: { id: u.id }, data: { firstName: "Modifié" } });
  assert.equal((await read(u, last.id)).cashierName, "Identité enregistrée");
  assert.equal(await untouched(), baseline);
});
