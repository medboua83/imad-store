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
  const { Server: TcpServer } = require("node:net");
  const originalTcpListen = TcpServer.prototype.listen;
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
    TcpServer.prototype.listen = function(...args) {
      assert.equal(publicBinding, false, "LiteSpeed permits only one installed public listener");
      publicBinding = true;
      return originalListen.apply(this, args);
    };
  }
  try {
    await mongo.connect();
    await prisma.user.create({ data: { email: "hosted@example.invalid", passwordHash: await bcrypt.hash("isolated-hosted-test", 10), firstName: "Test", lastName: "Isolated", role: "ADMIN" } });
    const category = await prisma.category.create({ data: { slug: "hosted-test", nameFr: "Test", nameAr: "اختبار", nameEn: "Test" } });
    await prisma.storeSettings.create({ data: { id: "settings", deliveryMaxDays: 3, returnWindowDays: 3, returnFeePayer: "DELIVERY_TRY_ON" } });
    const complement = await prisma.product.create({ data: {
      slug: "hosted-complement-test", nameFr: "HOSTED COMPLEMENT", nameAr: "HOSTED COMPLEMENT", nameEn: "HOSTED COMPLEMENT",
      descriptionFr: "Test", descriptionAr: "Test", descriptionEn: "Test", price: 50, status: "ACTIVE", images: ["/images/cat-abayas.png"], categoryId: category.id,
      variants: { create: [{ color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", stock: 3, sku: "HOSTED-COMPLEMENT" }] },
    } });
    await prisma.product.create({ data: {
      slug: "hosted-product-test", nameFr: "HOSTED CATALOGUE TEST", nameAr: "HOSTED CATALOGUE TEST", nameEn: "HOSTED CATALOGUE TEST",
      descriptionFr: "Test", descriptionAr: "Test", descriptionEn: "Test", price: 100, status: "ACTIVE", images: ["/images/cat-abayas.png"], categoryId: category.id,
      recommendationSettings: { enabled: true, upsellProductIds: [], crossSellProductIds: [complement.id] },
      variants: { create: [{ color: "#000000", colorNameFr: "Noir", colorNameAr: "أسود", colorNameEn: "Black", stock: 3, sku: "HOSTED-TEST" }] },
    } });
    // Test even when a deployment accidentally enables the historical worker flag:
    // the hosted launcher must import app.js, never the worker-bearing index.js.
    process.env.DESKCOMM_OUTBOX_WORKER_ENABLED = "true";
    runtime = await require("../scripts/hosted-server.cjs").startHostedServer();
    const origin = `http://127.0.0.1:${runtime.publicServer.address().port}`;
    assert.equal("privateServer" in runtime, false);
    const read = globalThis[Symbol.for("imad.publicStoreRead")];
    assert.equal((await read("/products?status=DRAFT")).status, 403);
    assert.equal((await read("/products/admin/catalog")).status, 404);
    assert.equal((await read("/orders")).status, 404);
    if (mode !== "tcp") assert.equal(publicBinding, true);
    const get = (route, options) => fetch(origin + route, options);
    assert.equal((await get("/health")).status, 200);
    const recoveredHash = "3acee980f2b69333eac269c8a0a5eba5acda4467ae26c86bd61fa57e0c992315";
    const recovered = await get(`/uploads/${recoveredHash}.webp`);
    assert.equal(recovered.status, 200);
    assert.match(recovered.headers.get("content-type"), /image\/webp/);
    assert.equal(require("node:crypto").createHash("sha256").update(Buffer.from(await recovered.arrayBuffer())).digest("hex"), recoveredHash);
    assert.equal((await get("/api/products/admin/catalog")).status, 401);
    const products = await (await get("/api/products")).json();
    assert.match(JSON.stringify(products), /HOSTED CATALOGUE TEST/);
    assert.deepEqual((await read("/products")).body, products);
    assert.equal((await read("/products/not-published")).status, 404);
    const detail = await get("/products/hosted-product-test");
    assert.equal(detail.status, 200);
    const detailHtml = await detail.text();
    assert.match(detailHtml, /HOSTED CATALOGUE TEST/);
    assert.match(detailHtml, /HOSTED COMPLEMENT/);
    assert.match(detailHtml, /التوصيل خلال/);
    const delivery = await get("/delivery");
    assert.equal(delivery.status, 200);
    assert.match(await delivery.text(), /التوصيل خلال 3 أيام كحد أقصى/);
    const returns = await get("/returns");
    assert.equal(returns.status, 200);
    const returnsHtml = await returns.text();
    assert.match(returnsHtml, /خلال 3 أيام من استلام الطلب/);
    assert.match(returnsHtml, /يتحمل المتجر رسوم الإرجاع إذا تم تأكيد الإرجاع أثناء التجربة عند التسليم/);
    assert.match(returnsHtml, /بعد الدفع ومغادرة المندوب، يتحمل العميل رسوم/);
    const recommendations = await (await get("/api/products/hosted-product-test/recommendations")).json();
    assert.deepEqual(recommendations.data.upsell, []);
    assert.deepEqual(recommendations.data.crossSell.map(p => p.id), [complement.id]);
    assert.deepEqual((await read("/products/hosted-product-test/recommendations")).body, recommendations);
    const shop = await get("/shop");
    assert.equal(shop.status, 200);
    const shopHtml = await shop.text();
    assert.match(shopHtml, /HOSTED CATALOGUE TEST/);
    const home = await get("/");
    assert.equal(home.status, 200);
    const shareTag = (html, name) => html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]+)"`))?.[1];
    for (const html of [shopHtml, await home.text()]) {
      assert.match(shareTag(html, "og:image") || "", /\/images\/brand\/imad-share-gold-v1\.png$/);
      assert.ok(shareTag(html, "og:title"));
      assert.ok(shareTag(html, "og:description"));
      assert.equal(shareTag(html, "twitter:card"), "summary_large_image");
    }
    assert.match(shareTag(detailHtml, "og:image") || "", /\/images\/cat-abayas\.png$/);
    const card = await get("/images/brand/imad-share-gold-v1.png");
    assert.equal(card.status, 200);
    assert.match(card.headers.get("content-type"), /image\/png/);
    const dimensions = await sharp(Buffer.from(await card.arrayBuffer())).metadata();
    assert.equal(dimensions.width, 1200); assert.equal(dimensions.height, 630);
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
    TcpServer.prototype.listen = originalTcpListen;
    delete global.PhusionPassenger;
    delete global.LitespeedNodeJS;
    await runtime?.close();
    await prisma.$disconnect();
    await mongo.db(name).dropDatabase();
    await mongo.close();
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
  }
});
