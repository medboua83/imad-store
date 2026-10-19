const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const sharp = require("sharp");
const { rm } = require("node:fs/promises");
const name = process.env.TEST_DATABASE_NAME || "";
if (!/^imad_ci_[a-f0-9]{16}$/.test(name) || process.env.DATABASE_URL !== `mongodb://127.0.0.1:27017/${name}?replicaSet=rs0`)
  throw new Error("Run scripts/test-hosted-runtime.cjs with an isolated database");

const mode = process.env.TEST_HOST_MODE;
const passengerMode = mode === "passenger";
test(`Hosted ${mode} listener serves SSR, API, admin and photos without workers`, { timeout: 120000 }, async () => {
  const { prisma } = require("../backend/dist/lib/prisma.js");
  const mongo = new MongoClient(process.env.DATABASE_URL);
  let runtime;
  const { Server } = require("node:http");
  const originalListen = Server.prototype.listen;
  const savedOriginalListen = Server.prototype.originalListen;
  let configured = false, publicBinding = false;
  if (passengerMode) {
    // Emulate Passenger's documented reverse-port-binding contract using real
    // TCP sockets. The production socket itself is verified after deployment.
    global.PhusionPassenger = { configure(options) { assert.deepEqual(options, { autoInstall: false }); configured = true; } };
    Server.prototype.listen = function(...args) {
      assert.equal(configured, true, "Disable automatic interception before ANY listener");
      if (args[0] === "passenger") { publicBinding = true; args = [0, "127.0.0.1", args.at(-1)]; }
      return originalListen.apply(this, args);
    };
  } else if (mode === "litespeed") {
    // No marker or originalListen: actual hosted adapters need not expose them.
    Server.prototype.listen = function(...args) {
      assert.equal(publicBinding, false, "LiteSpeed permits only one installed public listener");
      publicBinding = true;
      return originalListen.apply(this, args);
    };
  }
  try {
    await mongo.connect();
    await prisma.user.create({ data: { email: "hosted@example.invalid", passwordHash: await bcrypt.hash("isolated-hosted-test", 10), firstName: "Test", lastName: "Isolated", role: "ADMIN" } });
    const category = await prisma.category.create({ data: { slug: "hosted-test", nameFr: "Test", nameAr: "اختبار", nameEn: "Test" } });
    await prisma.product.create({ data: {
      slug: "hosted-product-test", nameFr: "HOSTED CATALOGUE TEST", nameAr: "HOSTED CATALOGUE TEST", nameEn: "HOSTED CATALOGUE TEST",
      descriptionFr: "Test", descriptionAr: "Test", descriptionEn: "Test", price: 100, status: "ACTIVE", images: ["/images/cat-abayas.png"], categoryId: category.id,
      variants: { create: [{ color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", stock: 3, sku: "HOSTED-TEST" }] },
    } });
    // Test even when a deployment accidentally enables the historical worker flag:
    // the hosted launcher must import app.js, never the worker-bearing index.js.
    process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = "true";
    runtime = await require("../scripts/hosted-server.cjs").startHostedServer();
    const origin = `http://127.0.0.1:${runtime.publicServer.address().port}`;
    assert.notEqual(runtime.privateServer.address().port, runtime.publicServer.address().port);
    if (mode !== "tcp") assert.equal(publicBinding, true);
    const get = (route, options) => fetch(origin + route, options);
    assert.equal((await get("/health")).status, 200);
    assert.equal((await get("/api/products/admin/catalog")).status, 401);
    const products = await (await get("/api/products")).json();
    assert.match(JSON.stringify(products), /HOSTED CATALOGUE TEST/);
    const shop = await get("/shop");
    assert.equal(shop.status, 200); assert.match(await shop.text(), /HOSTED CATALOGUE TEST/);
    assert.equal((await get("/")).status, 200);
    assert.equal((await get("/admin")).status, 200);
    assert.equal((await get("/images/cat-abayas.png")).status, 200);
    const login = await get("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "hosted@example.invalid", password: "isolated-hosted-test" }) });
    assert.equal(login.status, 200);
    const session = await login.json();
    const authorization = `Bearer ${session.data.accessToken}`;
    const catalog = await get("/api/products/admin/catalog", { headers: { authorization } });
    assert.equal(catalog.status, 200); assert.match(catalog.headers.get("cache-control"), /no-store/);
    assert.match(await catalog.text(), /HOSTED CATALOGUE TEST/);
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#125432" } }).png().toBuffer();
    const uploaded = await get("/api/uploads", { method: "POST", headers: { authorization, "Content-Type": "image/png" }, body: image });
    assert.equal(uploaded.status, 201);
    const photo = await get((await uploaded.json()).data.url);
    assert.equal(photo.status, 200); assert.match(photo.headers.get("content-type"), /image\/webp/);
    assert.equal(await prisma.order.count(), 0);
    assert.equal(await mongo.db(name).collection("deskcomm_outbox").countDocuments(), 0);
  } finally {
    Server.prototype.listen = originalListen;
    if (savedOriginalListen) Server.prototype.originalListen = savedOriginalListen;
    else delete Server.prototype.originalListen;
    delete global.PhusionPassenger;
    delete global.LitespeedNodeJS;
    await runtime?.close();
    await prisma.$disconnect();
    await mongo.db(name).dropDatabase();
    await mongo.close();
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
  }
});
