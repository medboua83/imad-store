import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { MongoClient } from "mongodb";
import request from "supertest";
import jwt from "jsonwebtoken";
import sharp from "sharp";

const name = process.env.TEST_DATABASE_NAME || "";
if (
    !/^imad_ci_[a-f0-9]{16}$/.test(name) ||
    process.env.DATABASE_URL !== `mongodb://127.0.0.1:27017/${name}?replicaSet=rs0`
)
    throw new Error("Use npm run test:integration: isolated database required");
let prisma: any, app: any, product: any, category: any;
const token = jwt.sign(
    { id: "123456789012345678901234", role: "ADMIN", email: "admin@example.invalid" },
    process.env.JWT_SECRET!,
);
const admin = () => ({ Authorization: `Bearer ${token}` });
const mongo = new MongoClient(process.env.DATABASE_URL!);
const receipts: { key?: string; body: string; signature?: string; contentType?: string }[] = [];
let failDelivery = true;
const crm = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
        receipts.push({
            key: req.headers["idempotency-key"] as string,
            body,
            signature: req.headers["x-deskcomm-signature"] as string,
            contentType: req.headers["content-type"],
        });
        res.writeHead(failDelivery ? 503 : 200);
        res.end("ok");
    });
});
const payload = () => ({
    slug: `real-product-${randomBytes(4).toString("hex")}`,
    nameFr: "Sac cuir",
    nameAr: "حقيبة",
    nameEn: "Leather bag",
    descriptionFr: "Description",
    descriptionAr: "وصف",
    descriptionEn: "Description",
    price: 100,
    images: ["/images/cat-abayas.png"],
    categoryId: category.id,
    status: "ACTIVE",
    variants: [
        {
            color: "#000000",
            colorNameFr: "Noir",
            colorNameAr: "أسود",
            colorNameEn: "Black",
            stock: 5,
            sku: `SKU-${randomBytes(4).toString("hex")}`,
        },
    ],
});
const checkout = (quantity = 1) => ({
    paymentMethod: "COD",
    crmConsent: true,
    customer: {
        fullName: "TEST ISOLATED",
        phone: "+212600000099",
        street: "Adresse fictive test",
        city: "Rabat",
        region: "Rabat",
    },
    items: [{ productId: product.id, variantId: product.variants[0].id, quantity, price: 0.01 }],
});
const key = () => randomBytes(16).toString("hex");
before(async () => {
    await mongo.connect();
    const db = mongo.db(name);
    await db
        .collection("orders")
        .createIndex(
            { idempotencyKey: 1 },
            { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
        );
    await db.collection("deskcomm_outbox").createIndex({ orderId: 1 }, { unique: true });
    await db.collection("products").createIndex({ slug: 1 }, { unique: true });
    await db.collection("product_variants").createIndex({ sku: 1 }, { unique: true });
    await db.collection("telegram_customers").createIndex({ phone: 1 }, { unique: true });
    ({ prisma } = await import("../backend/src/lib/prisma"));
    ({ app } = await import("../backend/src/app"));
    category = await prisma.category.create({
        data: { slug: "bags", nameFr: "Sacs", nameAr: "حقائب", nameEn: "Bags" },
    });
    await new Promise<void>((resolve) => crm.listen(0, "127.0.0.1", resolve));
    const address = crm.address() as { port: number };
    const response = await request(app)
        .put("/api/integrations/deskcomm")
        .set(admin())
        .send({ enabled: true, webhookUrl: `http://127.0.0.1:${address.port}/fake-crm` });
    assert.equal(response.status, 200);
});
after(async () => {
    await prisma?.$disconnect();
    if (/^imad_ci_[a-f0-9]{16}$/.test(name)) await mongo.db(name).dropDatabase();
    await mongo.close();
    await new Promise<void>((resolve) => crm.close(() => resolve()));
    await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});
test("Invalid public queries return 400 without database diagnostics", async () => {
    for (const url of [
        "/api/products?limit=0",
        "/api/products?page=NaN",
        "/api/products?limit=101",
        "/api/orders/not-an-id",
    ]) {
        const response = await request(app).get(url);
        assert.equal(response.status, 400, url);
        assert.doesNotMatch(JSON.stringify(response.body), /Prisma|\/Users\/|findMany|stack/);
    }
    assert.equal((await request(app).get("/api/products?status=DRAFT")).status, 403);
    assert.equal((await request(app).get("/api/products/admin/catalog")).status, 401);
});
test("Grouped legacy sizes stay in admin history but cannot be sold or reserved", async () => {
    const input = payload();
    input.nameFr = input.slug;
    const invalid = {...input.variants[0], size:"40 41 42 43 44"};
    assert.equal((await request(app).post("/api/products").set(admin()).send({...input,variants:[invalid]})).status,400);
    const p = await prisma.product.create({data:{...input,variants:{create:[{...invalid,stock:9},{...input.variants[0],sku:`VALID-${key()}`,size:"40",stock:2}]}},include:{variants:true}});
    const legacy = p.variants.find((v:any)=>v.size === invalid.size);
    const publicView = await request(app).get(`/api/products/${p.slug}`);
    assert.equal(publicView.body.data.variants.length,1);
    const list = await request(app).get(`/api/products?search=${p.slug}`);
    assert.equal(list.body.data[0].variants.length,1);
    const adminView = await request(app).get(`/api/products/admin/catalog?search=${p.slug}`).set(admin());
    assert.equal(adminView.body.data[0].variants.length,2);
    const count = await prisma.order.count();
    const response = await request(app).post("/api/orders").set("Idempotency-Key",key()).send({paymentMethod:"COD",customer:{fullName:"TEST ISOLATED",phone:"+212600000099",street:"Adresse fictive test",city:"Rabat",region:"Rabat"},items:[{productId:p.id,variantId:legacy.id,quantity:1}]});
    assert.equal(response.status,400);
    assert.equal(await prisma.order.count(),count);
    assert.equal((await prisma.productVariant.findUnique({where:{id:legacy.id}})).stock,9);
    assert.equal((await request(app).put(`/api/products/${p.id}`).set(admin()).send({nameFr:"Nom corrigé"})).status,200);
    assert.equal((await request(app).put(`/api/products/${p.id}`).set(admin()).send({variants:[{...input.variants[0],size:"41 42",sku:`NEW-${key()}`}]})).status,400);
    await prisma.productVariant.deleteMany({where:{productId:p.id}});
    await prisma.product.delete({where:{id:p.id}});
});
test("Telegram requires a secret and a verified own contact", async () => {
    const body = {
        message: {
            chat: { id: 123, type: "private" },
            from: { id: 123, first_name: "Test" },
            text: "/start +212600000099",
        },
    };
    assert.equal((await request(app).post("/api/telegram/webhook").send(body)).status, 403);
    assert.equal(await prisma.telegramCustomer.count(), 0);
    const send = (b: any) =>
        request(app)
            .post("/api/telegram/webhook")
            .set("X-Telegram-Bot-Api-Secret-Token", process.env.TELEGRAM_WEBHOOK_SECRET!)
            .send(b);
    assert.equal((await send(body)).status, 200);
    assert.equal(await prisma.telegramCustomer.count(), 0);
    assert.equal(
        (
            await send({
                message: {
                    ...body.message,
                    contact: { user_id: 999, phone_number: "+212600000099" },
                },
            })
        ).status,
        400,
    );
    assert.equal(
        (
            await send({
                message: {
                    ...body.message,
                    contact: { user_id: 123, phone_number: "+212600000099" },
                },
            })
        ).status,
        200,
    );
    assert.ok(
        (await prisma.telegramCustomer.findUnique({ where: { phone: "+212600000099" } }))
            .verifiedAt,
    );
});
test("Unused card endpoints cannot create payments or mark orders paid", async () => {
    for (const url of ["/api/payments/create-intent", "/api/payments/webhook"])
        assert.equal((await request(app).post(url).send({ amount: 1 })).status, 410);
    assert.equal(await prisma.order.count(), 0);
});
test("Products require publication readiness; variants and stock can be edited", async () => {
    const incomplete = payload();
    incomplete.images = [];
    assert.equal(
        (await request(app).post("/api/products").set(admin()).send(incomplete)).status,
        400,
    );
    const response = await request(app).post("/api/products").set(admin()).send(payload());
    assert.equal(response.status, 201, JSON.stringify(response.body));
    product = response.body.data;
    const variant = product.variants[0];
    const update = await request(app)
        .put(`/api/products/${product.id}`)
        .set(admin())
        .send({ nameAr: "حقيبة جديدة", variants: [{ ...variant, expectedStock: 5, stock: 6 }] });
    assert.equal(update.status, 200);
    assert.equal(update.body.data.variants[0].stock, 6);
    assert.equal(update.body.data.nameAr, "حقيبة جديدة");
    assert.equal(
        (
            await request(app)
                .put(`/api/products/${product.id}`)
                .set(admin())
                .send({ variants: [{ ...variant, expectedStock: 5, stock: 8 }] })
        ).status,
        409,
    );
    const draft = { ...payload(), status: "DRAFT", images: [], variants: [] };
    const created = await request(app).post("/api/products").set(admin()).send(draft);
    assert.equal(created.status, 201);
    assert.equal((await request(app).get(`/api/products/${draft.slug}`)).status, 404);
    assert.equal((await request(app).get("/api/products")).body.total, 1);
    assert.equal(
        (await request(app).get("/api/products/admin/catalog").set(admin())).body.total,
        2,
    );
});
test("Image uploads are authenticated, validated, transformed and served", async () => {
    assert.equal(
        (
            await request(app)
                .post("/api/uploads")
                .set("Content-Type", "image/png")
                .send(Buffer.from("bad"))
        ).status,
        401,
    );
    assert.equal(
        (
            await request(app)
                .post("/api/uploads")
                .set(admin())
                .set("Content-Type", "image/png")
                .send(Buffer.from("<script/>"))
        ).status,
        400,
    );
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#aabbcc" } })
        .png()
        .toBuffer();
    const response = await request(app)
        .post("/api/uploads")
        .set(admin())
        .set("Content-Type", "image/png")
        .send(png);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.match(response.body.data.url, /^\/uploads\/[a-f0-9]{64}\.webp$/);
    const image = await request(app).get(response.body.data.url);
    assert.equal(image.status, 200);
    assert.match(image.headers["content-type"], /image\/webp/);
});
test("Concurrent checkout creates one order and one CRM event; public tracking hides personal data", async () => {
    const idem = key(),
        body = checkout();
    const responses = await Promise.all(
        [1, 2].map(() => request(app).post("/api/orders").set("Idempotency-Key", idem).send(body)),
    );
    for (const response of responses)
        assert.ok([200, 201].includes(response.status), JSON.stringify(response.body));
    assert.equal(responses[0].body.data.id, responses[1].body.data.id);
    assert.equal(await prisma.order.count(), 1);
    assert.equal(await prisma.deskcommOutbox.count(), 1);
    const order = responses[0].body.data;
    assert.equal(order.totalAmount, 130);
    assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } })).stock,
        5,
    );
    const tracking = await request(app).get(`/api/orders/${order.id}`);
    assert.equal(tracking.status, 200);
    assert.deepEqual(Object.keys(tracking.body.data).sort(), [
        "createdAt",
        "id",
        "paymentStatus",
        "status",
    ]);
    assert.equal(tracking.headers["cache-control"], "no-store");
    assert.equal(
        (await request(app).post("/api/orders").set("Idempotency-Key", idem).send(checkout(2)))
            .status,
        409,
    );
});
test("carrier-incompatible new addresses are refused before stock reservation or outbox", async () => {
    const stock = await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } });
    const count = await prisma.order.count();
    const outbox = await prisma.deskcommOutbox.count();
    for (const invalid of [{ fullName: "AB" }, { street: "A".repeat(125) }, { city: "inconnue" }, { phone: "0600000000" }]) {
        const body = checkout();
        const response = await request(app).post("/api/orders").set("Idempotency-Key", key())
            .send({ ...body, customer: { ...body.customer, ...invalid } });
        assert.equal(response.status, 400, JSON.stringify(response.body));
        assert.equal(response.body.details[0].path[0], "customer");
    }
    assert.equal(await prisma.order.count(), count);
    assert.equal(await prisma.deskcommOutbox.count(), outbox);
    assert.deepEqual(await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } }), stock);
});
test("CRM retries use the same idempotency key; successful jobs are not resent", async () => {
    const { processDeskcommOutbox } = await import("../backend/src/lib/deskcomm-outbox");
    await processDeskcommOutbox();
    assert.equal(receipts.length, 1);
    let job = await prisma.deskcommOutbox.findFirst();
    assert.equal(job.status, "PENDING");
    await prisma.deskcommOutbox.update({
        where: { id: job.id },
        data: { nextAttemptAt: new Date(0) },
    });
    failDelivery = false;
    await Promise.all([processDeskcommOutbox(), processDeskcommOutbox()]);
    job = await prisma.deskcommOutbox.findFirst();
    assert.equal(job.status, "SENT");
    assert.equal(receipts.length, 2);
    assert.equal(receipts[0].key, receipts[1].key);
    assert.equal(receipts[0].body, receipts[1].body);
    await processDeskcommOutbox();
    assert.equal(receipts.length, 2);
});
test("Repeated concurrent cancellation restores stock once; invalid transitions fail", async () => {
    const order = await prisma.order.findFirst();
    const responses = await Promise.all(
        [1, 2].map(() =>
            request(app)
                .patch(`/api/orders/${order.id}/status`)
                .set(admin())
                .send({ status: "CANCELLED" }),
        ),
    );
    for (const response of responses)
        assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } })).stock,
        6,
    );
    assert.equal(
        await prisma.orderEvent.count({ where: { orderId: order.id, type: "status_changed" } }),
        1,
    );
    assert.equal(
        (
            await request(app)
                .patch(`/api/orders/${order.id}/status`)
                .set(admin())
                .send({ status: "CONFIRMED" })
        ).status,
        409,
    );
});
test("Overselling fails without an order or stock change; disabled COD rolls back reservation", async () => {
    assert.equal(
        (await request(app).post("/api/orders").set("Idempotency-Key", key()).send(checkout(7)))
            .status,
        409,
    );
    assert.equal(await prisma.order.count(), 1);
    await prisma.storeSettings.create({ data: { id: "settings", codEnabled: false } });
    assert.equal(
        (await request(app).post("/api/orders").set("Idempotency-Key", key()).send(checkout()))
            .status,
        409,
    );
    assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } })).stock,
        6,
    );
});
test("Fixture products stay out of the storefront and cannot be published", async () => {
    const fixture = { ...payload(), slug: "test-19a-hidden" };
    assert.equal((await request(app).post("/api/products").set(admin()).send(fixture)).status, 400);
    await prisma.product.create({ data: { ...fixture, variants: { create: fixture.variants } } });
    const listing = await request(app).get("/api/products");
    assert.equal(listing.body.total, 1);
    assert.equal((await request(app).get("/api/products/test-19a-hidden")).status, 404);
});
test("Sheets follows the same stock rules; shipped and unverified historical orders cannot be cancelled", async () => {
    await prisma.storeSettings.update({ where: { id: "settings" }, data: { codEnabled: true } });
    const { transitionOrderStatus } = await import("../backend/src/lib/order-lifecycle");
    const create = async () => {
        const response = await request(app)
            .post("/api/orders")
            .set("Idempotency-Key", key())
            .send(checkout());
        assert.equal(response.status, 201);
        return response.body.data;
    };
    const sheetOrder = await create();
    await transitionOrderStatus(sheetOrder.id, "CANCELLED", "sheets");
    assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } })).stock,
        6,
    );
    const shipped = await create();
    await transitionOrderStatus(shipped.id, "CONFIRMED");
    await transitionOrderStatus(shipped.id, "SHIPPED");
    await assert.rejects(transitionOrderStatus(shipped.id, "CANCELLED"), /non autorisé/);
    const historical = await create();
    await mongo
        .db(name)
        .collection("orders")
        .updateOne(
            { _id: new (await import("mongodb")).ObjectId(historical.id) },
            { $unset: { inventoryReserved: "" } },
        );
    await assert.rejects(
        transitionOrderStatus(historical.id, "CANCELLED"),
        /historique non vérifiée/,
    );
});
test("Competing independent orders never oversell the last unit", async () => {
    await prisma.productVariant.update({
        where: { id: product.variants[0].id },
        data: { stock: 1 },
    });
    const responses = await Promise.all(
        [1, 2].map(() =>
            request(app).post("/api/orders").set("Idempotency-Key", key()).send(checkout()),
        ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } })).stock,
        0,
    );
});

test("Publication keeps drafts private, detects conflicts and supports rollback", async () => {
    const initial = await request(app).get("/api/content");
    assert.equal(initial.status, 200);
    const base = initial.body.data;
    assert.equal((await request(app).get("/api/content/admin")).status, 401);
    const edited = { ...base, heroTitle: "Titre privé de vérification" };
    const save = await request(app)
        .post("/api/content/draft")
        .set(admin())
        .send({ expectedRevision: 0, content: edited });
    assert.equal(save.status, 200, JSON.stringify(save.body));
    assert.equal((await request(app).get("/api/content")).body.data.heroTitle, base.heroTitle);
    assert.equal(
        (await request(app).post("/api/content/publish").set(admin()).send({ expectedRevision: 0 }))
            .status,
        409,
    );
    const publish = await request(app)
        .post("/api/content/publish")
        .set(admin())
        .send({ expectedRevision: 1 });
    assert.equal(publish.status, 200);
    assert.equal((await request(app).get("/api/content")).body.data.heroTitle, edited.heroTitle);
    assert.equal(
        (
            await request(app)
                .post("/api/content/rollback")
                .set(admin())
                .send({ expectedRevision: 2 })
        ).status,
        200,
    );
    assert.equal((await request(app).get("/api/content")).body.data.heroTitle, base.heroTitle);
    const privateResponse = await request(app).get("/api/content/admin").set(admin());
    assert.match(privateResponse.headers["cache-control"], /no-store/);
});
test("Commercial text requires explicit review and unsafe banner URLs are rejected", async () => {
    const base = (await request(app).get("/api/content/admin").set(admin())).body.data;
    const content = { ...base.draft, deliveryText: "Texte non validé", policiesVerified: false };
    assert.equal(
        (
            await request(app)
                .post("/api/content/draft")
                .set(admin())
                .send({ expectedRevision: base.revision, content })
        ).status,
        200,
    );
    assert.equal(
        (
            await request(app)
                .post("/api/content/publish")
                .set(admin())
                .send({ expectedRevision: base.revision + 1 })
        ).status,
        400,
    );
    assert.equal(
        (
            await request(app)
                .post("/api/content/draft")
                .set(admin())
                .send({
                    expectedRevision: base.revision + 1,
                    content: {
                        ...content,
                        banners: [
                            {
                                title: "Unsafe",
                                image: "/images/hero-1.png",
                                href: "javascript:alert(1)",
                            },
                        ],
                    },
                })
        ).status,
        400,
    );
});
test("Catalog search, price, stock, sort and pagination cover products beyond the first page", async () => {
    const records = Array.from({ length: 14 }, (_, i) => {
        const body = payload();
        return {
            ...body,
            slug: `browse-${String(i).padStart(2, "0")}`,
            price: 20 + i,
            nameFr: `Recherche ${i}`,
            nameAr: `تصفّح ${i}`,
            nameEn: `Discovery ${i}`,
            variants: { create: body.variants },
        };
    });
    for (const data of records) await prisma.product.create({ data });
    const page = await request(app).get(
        "/api/products?search=Discovery&limit=12&page=2&sort=price-asc",
    );
    assert.equal(page.status, 200);
    assert.equal(page.body.total, 14);
    assert.equal(page.body.data.length, 2);
    assert.equal(page.body.data[0].price, 32);
    const filtered = await request(app).get(
        "/api/products?search=Recherche&minPrice=25&maxPrice=27&sort=price-desc&availability=in-stock",
    );
    assert.equal(filtered.body.total, 3);
    assert.equal(filtered.body.data[0].price, 27);
    assert.equal((await request(app).get("/api/products?minPrice=100&maxPrice=1")).status, 400);
    assert.equal((await request(app).get("/api/products?sort=unsafe")).status, 400);
    assert.equal(
        (await request(app).get("/api/products?search=" + encodeURIComponent("تصفّح"))).body.total,
        14,
    );
});
test("Changed checkout totals require another review and do not reserve stock", async () => {
    await prisma.productVariant.update({
        where: { id: product.variants[0].id },
        data: { stock: 3 },
    });
    const before = await prisma.order.count();
    const response = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", key())
        .send({ ...checkout(), expectedTotal: 1 });
    assert.equal(response.status, 409);
    assert.equal(await prisma.order.count(), before);
    assert.equal(
        (await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } })).stock,
        3,
    );
});
test("Refresh rotates sessions, rejects replay and logout revokes the refresh token", async () => {
    const { default: bcrypt } = await import("bcryptjs");
    const email = "session@example.invalid";
    await prisma.user.create({
        data: {
            email,
            passwordHash: await bcrypt.hash("Isolated-session-test", 10),
            firstName: "Session",
            lastName: "Test",
            role: "ADMIN",
        },
    });
    const login = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "Isolated-session-test" });
    assert.equal(login.status, 200);
    const expired = jwt.sign(
        { id: "123456789012345678901234", role: "ADMIN" },
        process.env.JWT_SECRET!,
        { expiresIn: -1 },
    );
    assert.equal(
        (await request(app).get("/api/content/admin").set("Authorization", `Bearer ${expired}`))
            .status,
        401,
    );
    const old = login.body.data.refreshToken;
    const refreshed = await request(app).post("/api/auth/refresh").send({ token: old });
    assert.equal(refreshed.status, 200);
    assert.notEqual(refreshed.body.data.refreshToken, old);
    assert.equal((await request(app).post("/api/auth/refresh").send({ token: old })).status, 401);
    assert.equal(
        (
            await request(app)
                .get("/api/content/admin")
                .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`)
        ).status,
        200,
    );
    await request(app).post("/api/auth/logout").send({ token: refreshed.body.data.refreshToken });
    assert.equal(
        (
            await request(app)
                .post("/api/auth/refresh")
                .send({ token: refreshed.body.data.refreshToken })
        ).status,
        401,
    );
});

test("Demo seeding refuses a live database and startup has no automatic fixture side effects", async () => {
    const { ensureProductionData } = await import("../backend/src/lib/seedAdmin");
    const original = process.env.DATABASE_URL;
    try {
        process.env.DATABASE_URL = "mongodb://127.0.0.1:27017/imad_store_test?replicaSet=rs0";
        await assert.rejects(ensureProductionData(), /restricted/);
    } finally {
        process.env.DATABASE_URL = original;
    }
    await assert.rejects(ensureProductionData(true), /restricted/);
});

test("An empty server startup does not publish demo data even with a legacy seed flag", async () => {
    const { spawn } = await import("node:child_process");
    const isolated = `imad_ci_${randomBytes(8).toString("hex")}`;
    const child = spawn(process.execPath, ["--import", "tsx", "backend/src/index.ts"], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            DATABASE_URL: `mongodb://127.0.0.1:27017/${isolated}?replicaSet=rs0`,
            PORT: "0",
            IMAD_SEED_DEMO: "true",
            DESKCOMM_OUTBOX_WORKER_ENABLED: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });
    try {
        const port = await new Promise<number>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Startup timeout")), 8000);
            child.stdout.on("data", (chunk) => {
                const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
                if (match) {
                    clearTimeout(timer);
                    resolve(Number(match[1]));
                }
            });
            child.on("exit", () => {
                clearTimeout(timer);
                reject(new Error("Server exited"));
            });
        });
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        assert.equal(response.status, 200);
        await new Promise((resolve) => setTimeout(resolve, 150));
        assert.equal(await mongo.db(isolated).collection("products").countDocuments(), 0);
        assert.equal(await mongo.db(isolated).collection("site_content").countDocuments(), 0);
    } finally {
        child.kill("SIGTERM");
        await new Promise((resolve) => child.once("exit", resolve));
        if (/^imad_ci_[a-f0-9]{16}$/.test(isolated)) await mongo.db(isolated).dropDatabase();
    }
});

test("CRM diagnostics are admin-only, read-only and distinguish missing events", async () => {
    assert.equal(
        (await request(app).get("/api/integrations/deskcomm/orders/12345678")).status,
        401,
    );
    assert.equal(
        (await request(app).get("/api/integrations/deskcomm/orders/invalid").set(admin())).status,
        400,
    );
    const createdProduct = await request(app).post("/api/products").set(admin()).send(payload());
    assert.equal(createdProduct.status, 201);
    const p = createdProduct.body.data;
    const body = {
        ...checkout(),
        crmConsent: false,
        items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 1 }],
    };
    assert.equal(
        (await request(app).put("/api/integrations/deskcomm").set(admin()).send({ enabled: false }))
            .status,
        200,
    );
    const created = await request(app).post("/api/orders").set("Idempotency-Key", key()).send(body);
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    const before = await prisma.deskcommOutbox.count();
    const status = await request(app)
        .get(`/api/integrations/deskcomm/orders/${id.slice(-8)}`)
        .set(admin());
    assert.equal(status.status, 200);
    assert.equal(status.headers["cache-control"], "no-store");
    assert.equal(status.body.data.state, "NO_EVENT");
    assert.equal(status.body.data.attempts, 0);
    assert.equal(JSON.stringify(status.body).includes(body.customer.phone), false);
    assert.equal(
        (await request(app).put("/api/integrations/deskcomm").set(admin()).send({ enabled: true }))
            .status,
        200,
    );
    const consented = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", key())
        .send({ ...body, crmConsent: true });
    assert.equal(consented.status, 201);
    const pending = await request(app)
        .get(`/api/integrations/deskcomm/orders/${consented.body.data.id}`)
        .set(admin());
    assert.equal(pending.body.data.state, "PENDING");
    assert.equal(await prisma.deskcommOutbox.count(), before + 1);
    const config = await request(app).get("/api/integrations/deskcomm").set(admin());
    assert.equal(typeof config.body.data.worker.scheduled, "boolean");
    assert.equal(config.body.data.webhookCiphertext, undefined);
    assert.equal(config.body.data.webhookUrl, undefined);
});

test("Only the administrator controls CRM queueing; pause preserves jobs and enabling never backfills", async () => {
    const response = await request(app).post("/api/products").set(admin()).send(payload());
    assert.equal(response.status, 201);
    const p = response.body.data;
    const body = {
        ...checkout(),
        items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 1 }],
    };
    delete (body as { crmConsent?: boolean }).crmConsent;
    const off = await request(app)
        .put("/api/integrations/deskcomm")
        .set(admin())
        .send({ enabled: false });
    assert.equal(off.status, 200);
    const beforePause = await prisma.deskcommOutbox.findMany({
        orderBy: { id: "asc" },
        select: { id: true, status: true, attempts: true },
    });
    const receiptsBefore = receipts.length;
    const { processDeskcommOutbox } = await import("../backend/src/lib/deskcomm-outbox");
    await processDeskcommOutbox();
    assert.deepEqual(
        await prisma.deskcommOutbox.findMany({
            orderBy: { id: "asc" },
            select: { id: true, status: true, attempts: true },
        }),
        beforePause,
    );
    assert.equal(receipts.length, receiptsBefore);
    const disabledOrder = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", key())
        .send({ ...body, crmConsent: true });
    assert.equal(disabledOrder.status, 201);
    assert.equal(
        await prisma.deskcommOutbox.findUnique({ where: { orderId: disabledOrder.body.data.id } }),
        null,
    );
    assert.equal(
        (await request(app).put("/api/integrations/deskcomm").set(admin()).send({ enabled: true }))
            .status,
        200,
    );
    const idem = key();
    const calls = await Promise.all(
        [1, 2].map(() => request(app).post("/api/orders").set("Idempotency-Key", idem).send(body)),
    );
    for (const call of calls) assert.ok([200, 201].includes(call.status));
    assert.equal(calls[0].body.data.id, calls[1].body.data.id);
    assert.equal(
        await prisma.deskcommOutbox.count({ where: { orderId: calls[0].body.data.id } }),
        1,
    );
    const legacyFalse = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", key())
        .send({ ...body, crmConsent: false });
    assert.equal(legacyFalse.status, 201);
    assert.equal(
        await prisma.deskcommOutbox.count({ where: { orderId: legacyFalse.body.data.id } }),
        1,
    );
    assert.equal(
        await prisma.deskcommOutbox.findUnique({ where: { orderId: disabledOrder.body.data.id } }),
        null,
    );
});

test("Signed CRM confirmations update one existing order exactly once and never regress status", async () => {
    const prefix = "DESKCOMM_STATUS_";
    const saved = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => k.startsWith(prefix)),
    );
    const pipeline = randomUUID(),
        stage = randomUUID(),
        lead = randomUUID();
    const secret = "cd".repeat(32);
    Object.assign(process.env, {
        DESKCOMM_STATUS_CALLBACK_ENABLED: "true",
        DESKCOMM_STATUS_CALLBACK_SECRET: secret,
        DESKCOMM_STATUS_PIPELINE_ID: pipeline,
        DESKCOMM_STATUS_CONFIRMED_STAGE_ID: stage,
        DESKCOMM_STATUS_ORDER_FIELD: "pedido_id",
        DESKCOMM_STATUS_MIN_OCCURRED_AT: "2026-01-01T00:00:00.000Z",
    });
    const endpoint = "/api/integrations/deskcomm/status-callback";
    const send = (body: any, timestamp = Math.floor(Date.now() / 1000), signingSecret = secret) => {
        const raw = JSON.stringify(body);
        const signature = createHmac("sha256", signingSecret)
            .update(`${timestamp}.${body.delivery_id}.${raw}`)
            .digest("hex");
        return request(app)
            .post(endpoint)
            .set("Content-Type", "application/json")
            .set("X-Webhook-Delivery", body.delivery_id)
            .set("X-Webhook-Signature", `t=${timestamp},v1=${signature}`)
            .send(raw);
    };
    try {
        const createdProduct = await request(app)
            .post("/api/products")
            .set(admin())
            .send(payload());
        assert.equal(createdProduct.status, 201);
        const p = createdProduct.body.data;
        const created = await request(app)
            .post("/api/orders")
            .set("Idempotency-Key", key())
            .send({
                ...checkout(),
                items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 1 }],
            });
        assert.equal(created.status, 201);
        const id = created.body.data.id;
        const event = {
            event: "lead.stage_changed",
            delivery_id: randomUUID(),
            happened_at: new Date().toISOString(),
            data: {
                to_stage_id: stage,
                lead: {
                    id: lead,
                    pipeline_id: pipeline,
                    stage_id: stage,
                    custom_fields: { pedido_id: id },
                },
            },
        };
        assert.equal((await request(app).post(endpoint).send(event)).status, 401);
        assert.equal((await send(event, Math.floor(Date.now() / 1000) - 301)).status, 401);
        assert.equal((await send(event, undefined, "ef".repeat(32))).status, 401);
        assert.equal(
            (
                await send({
                    ...event,
                    data: {
                        ...event.data,
                        lead: { ...event.data.lead, pipeline_id: randomUUID() },
                    },
                })
            ).status,
            403,
        );
        assert.equal(
            (await send({ ...event, happened_at: "2025-01-01T00:00:00.000Z" })).body.ignored,
            true,
        );
        assert.equal(
            (await send({ ...event, data: { ...event.data, to_stage_id: randomUUID() } })).body
                .ignored,
            true,
        );
        assert.equal(
            (
                await send({
                    ...event,
                    data: {
                        ...event.data,
                        lead: { ...event.data.lead, custom_fields: { pedido_id: id.slice(-8) } },
                    },
                })
            ).status,
            400,
        );
        assert.equal((await send(event)).status, 409);
        await prisma.deskcommOutbox.update({ where: { orderId: id }, data: { status: "SENT" } });
        const counts = {
            orders: await prisma.order.count(),
            outbox: await prisma.deskcommOutbox.count(),
            events: await prisma.orderEvent.count({ where: { orderId: id } }),
            notifications: await prisma.adminNotification.count({ where: { orderId: id } }),
        };
        const stock = (await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } }))
            .stock;
        const calls = await Promise.all([send(event), send(event), send(event)]);
        assert.deepEqual(
            calls.map((r) => r.status),
            [200, 200, 200],
        );
        assert.equal(calls.filter((r) => r.body.data.changed).length, 1);
        assert.equal(
            (await send({ ...event, occurred_at: new Date().toISOString() })).body.data.changed,
            false,
        );
        assert.equal(
            (await send({ ...event, delivery_id: randomUUID() })).body.data.changed,
            false,
        );
        assert.equal(
            (await send({ ...event, happened_at: new Date(Date.now() + 1000).toISOString() }))
                .status,
            409,
        );
        assert.equal(await prisma.order.count(), counts.orders);
        assert.equal(await prisma.deskcommOutbox.count(), counts.outbox);
        assert.equal(await prisma.orderEvent.count({ where: { orderId: id } }), counts.events + 1);
        assert.equal(
            await prisma.adminNotification.count({ where: { orderId: id } }),
            counts.notifications + 1,
        );
        assert.equal(
            (await prisma.productVariant.findUnique({ where: { id: p.variants[0].id } })).stock,
            stock,
        );
        assert.equal((await prisma.order.findUnique({ where: { id } })).paymentStatus, "PENDING");
        await prisma.order.update({ where: { id }, data: { status: "SHIPPED" } });
        assert.equal(
            (await send({ ...event, delivery_id: randomUUID() })).body.data.status,
            "SHIPPED",
        );
        await prisma.order.update({ where: { id }, data: { status: "CANCELLED" } });
        assert.equal((await send({ ...event, delivery_id: randomUUID() })).status, 409);
        assert.equal((await prisma.order.findUnique({ where: { id } })).status, "CANCELLED");
        delete process.env.DESKCOMM_STATUS_CALLBACK_ENABLED;
        assert.equal((await send(event)).status, 503);
    } finally {
        for (const k of Object.keys(process.env)) if (k.startsWith(prefix)) delete process.env[k];
        Object.assign(process.env, saved);
    }
});

test("Explicit WhatsApp request is saved once and signed as typed JSON; legacy orders never gain consent", async () => {
    const { ORDER_WHATSAPP_NOTICE_VERSION: version } = await import("@imad-store/shared");
    const secret = "73".repeat(32),
        endpoint = "/api/integrations/deskcomm";
    assert.equal(
        (await request(app).put(endpoint).send({ enabled: true, signingSecret: secret })).status,
        401,
    );
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ enabled: true, signingSecret: "bad" })
        ).status,
        400,
    );
    assert.equal(
        (await request(app).get("/api/settings")).body.data.whatsappAssistanceAvailable,
        false,
    );
    const beforeJobs = await prisma.deskcommOutbox.findMany();
    const saved = await request(app)
        .put(endpoint)
        .set(admin())
        .send({ enabled: true, signingSecret: secret });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.signedSending, true);
    const publicSettings = await request(app).get("/api/settings");
    assert.equal(publicSettings.body.data.whatsappAssistanceAvailable, true);
    assert.doesNotMatch(JSON.stringify(publicSettings.body), new RegExp(secret));
    assert.doesNotMatch(JSON.stringify(saved.body), new RegExp(secret));
    const config = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    assert.ok(config.signingCiphertext);
    assert.doesNotMatch(config.signingCiphertext, new RegExp(secret));
    const createdProduct = await request(app).post("/api/products").set(admin()).send(payload());
    assert.equal(createdProduct.status, 201);
    const p = createdProduct.body.data;
    const body = {
        ...checkout(),
        aiServiceConsent: true,
        aiServiceConsentVersion: version,
        items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 1 }],
    };
    const count = await prisma.order.count();
    assert.equal(
        (
            await request(app)
                .post("/api/orders")
                .set("Idempotency-Key", key())
                .send({ ...body, aiServiceConsentVersion: "invented" })
        ).status,
        400,
    );
    assert.equal(
        (
            await request(app)
                .post("/api/orders")
                .set("Idempotency-Key", key())
                .send({ ...body, aiServiceConsentVersion: undefined })
        ).status,
        400,
    );
    assert.equal(
        (
            await request(app)
                .post("/api/orders")
                .set("Idempotency-Key", key())
                .send({ ...body, customer: { ...body.customer, phone: "0600000099" } })
        ).status,
        400,
    );
    assert.equal(await prisma.order.count(), count);
    const requestKey = key();
    const [a, b] = await Promise.all([
        request(app).post("/api/orders").set("Idempotency-Key", requestKey).send(body),
        request(app).post("/api/orders").set("Idempotency-Key", requestKey).send(body),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal(a.body.data.id, b.body.data.id);
    const id = a.body.data.id,
        order = await prisma.order.findUnique({ where: { id } });
    assert.equal(order.aiServiceConsent, true);
    assert.equal(order.aiServiceConsentVersion, version);
    assert.ok(order.aiServiceConsentAt);
    assert.equal(
        (
            await request(app)
                .post("/api/orders")
                .set("Idempotency-Key", requestKey)
                .send({ ...body, aiServiceConsent: false })
        ).status,
        409,
    );
    const job = await prisma.deskcommOutbox.findUnique({ where: { orderId: id } });
    assert.equal(job.payload.aiServiceConsent, true);
    assert.equal(job.payload.aiServiceConsentVersion, version);
    // Configuration writes do not rewrite old outbox payloads or replay historical orders.
    for (const old of beforeJobs)
        assert.deepEqual(
            (await prisma.deskcommOutbox.findUnique({ where: { id: old.id } })).payload,
            old.payload,
        );
    const { sendOrderToDeskcomm } = await import("../backend/src/lib/deskcomm-crm");
    failDelivery = false;
    await sendOrderToDeskcomm(job.payload);
    const received = receipts.at(-1)!;
    assert.match(received.contentType!, /application\/json/);
    assert.equal(
        received.signature,
        createHmac("sha256", secret).update(received.body).digest("hex"),
    );
    const data = JSON.parse(received.body);
    assert.equal(data.ai_service_consent, true);
    assert.equal(data.ai_service_consent_version, version);
    assert.equal(data.submission_status, "completed");
    assert.equal(data.external_id, `imad-store-${id}`);
    assert.equal(data.pedido_id, id);
    assert.ok(data.message.includes(`Client de la commande: ${body.customer.fullName}\n`));
    assert.ok(data.message.includes(`#${id.slice(-8).toUpperCase()}\n`));
    assert.ok(data.message.includes(`Adresse de livraison: ${body.customer.street}\n`));
    assert.ok(data.message.includes(`Ville: rabat\nRégion: ${body.customer.region}`));
    assert.equal(data.telefone, body.customer.phone);
    assert.equal(data.ai_service_phone_explicit, undefined); // Established only by CRM from the original phone.
    await sendOrderToDeskcomm({ ...job.payload, aiServiceConsentVersion: undefined });
    assert.equal(JSON.parse(receipts.at(-1)!.body).ai_service_consent, false);
    await sendOrderToDeskcomm({ ...job.payload, phone: "0600000099" });
    assert.equal(JSON.parse(receipts.at(-1)!.body).ai_service_consent, false);
    await sendOrderToDeskcomm({
        ...job.payload,
        aiServiceConsent: undefined,
        aiServiceConsentVersion: undefined,
    });
    const historical = JSON.parse(receipts.at(-1)!.body);
    assert.equal(historical.ai_service_consent, false);
    assert.equal(historical.ai_service_consent_version, undefined);
    await sendOrderToDeskcomm({
        ...job.payload,
        captureVersion: undefined,
        aiServiceConsent: undefined,
        aiServiceConsentVersion: undefined,
    });
    const oldDelivery = receipts.at(-1)!;
    assert.match(oldDelivery.contentType!, /application\/x-www-form-urlencoded/);
    assert.equal(new URLSearchParams(oldDelivery.body).get("ai_service_consent"), null);
    assert.equal(new URLSearchParams(oldDelivery.body).get("external_id"), null);
    assert.equal(
        oldDelivery.signature,
        createHmac("sha256", secret).update(oldDelivery.body).digest("hex"),
    );
    assert.equal(
        (await request(app).put(endpoint).set(admin()).send({ enabled: true })).body.data
            .signedSending,
        true,
    );
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ enabled: true, clearSigningSecret: true })
        ).body.data.signedSending,
        false,
    );
});

test("Published category counts exclude drafts and automatically follow newly published products", async () => {
    const categoryData={slug:`isolated-category-${key()}`,nameFr:"Collection test",nameAr:"تجربة",nameEn:"Test"};
    const c=await prisma.category.create({data:categoryData});
    const p=await prisma.product.create({data:{...payload(),categoryId:c.id,status:"DRAFT",variants:{create:payload().variants}}});
    const read=async()=> (await request(app).get("/api/categories")).body.data.find((entry:any)=>entry.id===c.id);
    assert.equal((await read()).publishedCount,0);
    assert.equal((await read())._count.products,1);
    await prisma.product.update({where:{id:p.id},data:{status:"ACTIVE"}});
    assert.equal((await read()).publishedCount,1);
    await prisma.product.update({where:{id:p.id},data:{images:[]}});
    assert.equal((await read()).publishedCount,0);
    await prisma.product.update({where:{id:p.id},data:{images:["/images/test.webp"],status:"ARCHIVED"}});
    assert.equal((await read()).publishedCount,0);
});

test("Visitor statistics validate events, deduplicate concurrent views and exclude test/admin/bot traffic", async () => {
    const db = mongo.db(name),
        events = db.collection("store_analytics");
    await events.deleteMany({});
    const endpoint = "/api/analytics/events",
        session = randomUUID();
    assert.equal((await request(app).get("/api/analytics/summary")).status, 401);
    const customer = jwt.sign(
        { id: "123456789012345678901234", role: "CUSTOMER" },
        process.env.JWT_SECRET!,
    );
    assert.equal(
        (
            await request(app)
                .get("/api/analytics/summary")
                .set("Authorization", `Bearer ${customer}`)
        ).status,
        403,
    );
    for (const body of [
        { session, page: "/admin" },
        { session, page: "/?phone=private" },
        { session, page: "/", companyId: randomUUID() },
        { session, page: "/", orderId: "invented" },
    ])
        assert.equal((await request(app).post(endpoint).send(body)).status, 400);
    assert.equal(
        (
            await request(app)
                .post(endpoint)
                .set("Origin", "https://unrelated.invalid")
                .send({ session, page: "/" })
        ).status,
        403,
    );
    for (const headers of [
        admin(),
        { DNT: "1" },
        { "Sec-GPC": "1" },
        { "User-Agent": "Googlebot" },
    ]) {
        const response = await request(app)
            .post(endpoint)
            .set(headers)
            .send({ session, page: "/" });
        assert.equal(response.status, 202);
        assert.equal(response.body.recorded, false);
    }
    const item = await prisma.product.create({
        data: { ...payload(), variants: { create: payload().variants } },
    });
    await Promise.all(
        Array.from({ length: 5 }, () =>
            request(app)
                .post(endpoint)
                .send({ session, page: `/products/${item.slug}` })
                .expect(202),
        ),
    );
    await request(app).post(endpoint).send({ session, page: "/" }).expect(202);
    await request(app)
        .post(endpoint)
        .send({ session: randomUUID(), page: "/", test: true })
        .expect(202);
    const summary = await request(app).get("/api/analytics/summary?days=7").set(admin());
    assert.equal(summary.status, 200);
    assert.match(summary.headers["cache-control"], /private, no-store/);
    assert.equal(summary.body.data.visits, 1);
    assert.equal(summary.body.data.pageViews, 2);
    assert.equal(summary.body.data.productViews, 1);
    assert.equal(summary.body.data.orderRate, 0);
    await Promise.all(Array.from({length:5},()=>request(app).post(endpoint).send({session,page:`/products/${item.slug}`,action:"cart"}).expect(202)));
    await request(app).post(endpoint).send({session,page:"/checkout"}).expect(202);
    assert.equal((await request(app).post(endpoint).send({session,page:"/products/missing",action:"cart"})).body.recorded,false);
    for(const headers of [admin(),{DNT:"1"},{"Sec-GPC":"1"}])
        assert.equal((await request(app).post(endpoint).set(headers).send({session:randomUUID(),page:`/products/${item.slug}`,action:"cart"})).body.recorded,false);
    const funnel=(await request(app).get("/api/analytics/summary").set(admin())).body.data.funnel;
    assert.equal(funnel.cartVisits,1);
    assert.equal(funnel.checkoutVisits,1);
    assert.equal(await events.countDocuments({kind:"cart"}),1);
    const cart=await events.findOne({kind:"cart"});
    assert.deepEqual(Object.keys(cart!).sort(),["_id","scope","session","kind","test","at","expiresAt"].sort());
    assert.equal(summary.body.data.products[0].id, item.id);
    assert.equal(
        (await request(app).post(endpoint).send({ session, page: "/products/unpublished-missing" }))
            .body.recorded,
        false,
    );
    assert.equal(
        (await request(app).get("/api/analytics/summary?days=365").set(admin())).status,
        400,
    );
    const saved = await events.findOne({ kind: "page", test: false });
    assert.equal(saved?.session === session, false);
    assert.deepEqual(
        Object.keys(saved!).sort(),
        [
            "_id",
            "scope",
            "session",
            "kind",
            "page",
            "test",
            "at",
            "productId",
            "productName",
            "expiresAt",
        ].sort(),
    );
    assert.ok(saved?.expiresAt instanceof Date);
    assert.ok(
        (await events.indexes()).some(
            (index) => index.name === "analytics_retention" && index.expireAfterSeconds === 0,
        ),
    );
});

test("Only real committed orders convert visits; retries and multiple orders cannot inflate the conversion rate", async () => {
    await mongo.db(name).collection("store_analytics").deleteMany({});
    const session = randomUUID(),
        other = randomUUID();
    for (const id of [session, other])
        await request(app)
            .post("/api/analytics/events")
            .send({ session: id, page: "/checkout" })
            .expect(202);
    const item = await prisma.product.create({
        data: { ...payload(), variants: { create: payload().variants } },
        include: { variants: true },
    });
    const body = {
        ...checkout(),
        aiServiceConsent: false,
        items: [{ productId: item.id, variantId: item.variants[0].id, quantity: 1 }],
    };
    const key = randomUUID();
    for (let i = 0; i < 2; i++) {
        const response = await request(app)
            .post("/api/orders")
            .set("Idempotency-Key", key)
            .set("X-Analytics-Session", session)
            .send(body);
        assert.equal(response.status, i === 0 ? 201 : 200);
    }
    await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", randomUUID())
        .set("X-Analytics-Session", session)
        .send(body)
        .expect(201);
    const result = (await request(app).get("/api/analytics/summary?days=7").set(admin())).body.data;
    assert.equal(result.visits, 2);
    assert.equal(result.attributedOrders, 2);
    assert.equal(result.convertedVisits, 1);
    assert.equal(result.orderRate, 50);
    const {recordOrderStage}=await import("../backend/src/lib/store-analytics");
    const order=await prisma.order.findUnique({where:{idempotencyKey:key}});
    await Promise.all(Array.from({length:3},()=>recordOrderStage(order.id,"CONFIRMED")));
    await recordOrderStage(order.id,"PENDING");
    assert.equal((await request(app).get("/api/analytics/summary").set(admin())).body.data.funnel.confirmedOrders,1);
    await recordOrderStage(order.id,"DELIVERED");
    await recordOrderStage(order.id,"SHIPPED");
    assert.equal((await request(app).get("/api/analytics/summary").set(admin())).body.data.funnel.deliveredOrders,1);
    await recordOrderStage(order.id,"CANCELLED");
    await recordOrderStage("123456789012345678901234","CONFIRMED");
    const stages=(await request(app).get("/api/analytics/summary").set(admin())).body.data;
    assert.equal(stages.attributedOrders,2);
    assert.equal(stages.funnel.confirmedOrders,0);
    assert.equal(stages.funnel.cancelledOrders,1);
    // A broken analytics write must never turn a committed order into a checkout failure.
    const { prisma: client } = await import("../backend/src/lib/prisma");
    const original = client.$runCommandRaw.bind(client);
    client.$runCommandRaw = (() => Promise.reject(new Error("isolated analytics failure"))) as any;
    try {
        const created = await request(app)
            .post("/api/orders")
            .set("Idempotency-Key", randomUUID())
            .set("X-Analytics-Session", session)
            .send(body)
            .expect(201);
        const {transitionOrderStatus}=await import("../backend/src/lib/order-lifecycle");
        const result=await transitionOrderStatus(created.body.data.id,"CONFIRMED");
        assert.equal(result.order.status,"CONFIRMED");
        assert.equal((await prisma.order.findUnique({where:{id:created.body.data.id}})).status,"CONFIRMED");
    } finally {
        client.$runCommandRaw = original;
    }
    const { recordOrderConversion, recordPage } =
        await import("../backend/src/lib/store-analytics");
    client.$runCommandRaw = ((command: any) =>
        command.update === "store_analytics"
            ? Promise.resolve({ writeErrors: [{ code: 121 }] })
            : original(command)) as any;
    try {
        await assert.rejects(() => recordPage(randomUUID(), "/", false), /Analytics write failed/);
    } finally {
        client.$runCommandRaw = original;
    }
    await recordOrderConversion(randomUUID(), new Date(Date.now() - 86400_000), session, false);
    const again = (await request(app).get("/api/analytics/summary?days=7").set(admin())).body.data;
    assert.equal(again.attributedOrders, 2);
});

test("Analytics scope comes from the installation, never from request inputs, and periods ignore old/test records", async () => {
    const { analyticsScope, readAnalytics } = await import("../backend/src/lib/store-analytics");
    const collection = mongo.db(name).collection("store_analytics");
    await collection.deleteMany({});
    const session = randomUUID();
    await request(app).post("/api/analytics/events").send({ session, page: "/" }).expect(202);
    const company = randomUUID(),
        store = randomUUID(),
        now = Date.now();
    await collection.insertMany([
        {
            scope: `${company}:${store}`,
            session: "other-company",
            kind: "page",
            test: false,
            at: now,
        },
        {
            scope: analyticsScope(),
            session: "too-old",
            kind: "page",
            test: false,
            at: now - 10 * 86400_000,
        },
        { scope: analyticsScope(), session: "test-only", kind: "page", test: true, at: now },
    ]);
    assert.equal((await readAnalytics(7)).visits, 1);
    assert.equal((await readAnalytics(30)).visits, 2);
    assert.equal(
        (await request(app).get(`/api/analytics/summary?companyId=${company}`).set(admin())).status,
        400,
    );
    process.env.STORE_INSTANCE_ID = store;
    process.env.CRM_COMPANY_ID = company;
    try {
        assert.equal((await readAnalytics(7)).visits, 1);
        // Rebinding the live database to another installation is rejected before any API route.
        assert.equal((await request(app).get("/api/analytics/summary").set(admin())).status, 503);
    } finally {
        delete process.env.STORE_INSTANCE_ID;
        delete process.env.CRM_COMPANY_ID;
    }
});

test("Commerce settings and promotions validate inputs; server decides delivery and price", async () => {
    assert.equal((await request(app).put("/api/settings").set(admin()).send({ metaPixelMadPerUsd: 0 })).status, 400);
    assert.equal((await request(app).put("/api/settings").set(admin()).send({ metaPixelMadPerUsd: -2 })).status, 400);
    assert.equal((await request(app).put("/api/settings").send({ shippingCost: 0 })).status, 401);
    assert.equal((await request(app).put("/api/settings").set(admin()).send({ shippingCost: -1 })).status, 400);
    assert.equal((await request(app).put("/api/settings").set(admin()).send({ metaPixelId: "<script>", metaPixelEnabled: true })).status, 400);
    assert.equal((await request(app).put("/api/settings").set(admin()).send({ metaPixelId: null, metaPixelEnabled: true })).status, 400);
    const initial = await prisma.storeSettings.findUnique({ where: { id: "settings" } });
    try {
        assert.equal((await request(app).put("/api/settings").set(admin()).send({ shippingCost: 30, freeShippingMin: 500, metaPixelEnabled: false, metaPixelId: "123456789" })).status, 200);
        assert.equal((await request(app).put("/api/settings").set(admin()).send({ metaPixelMadPerUsd: 9.78 })).status, 200);
        assert.equal((await request(app).get("/api/settings")).body.data.metaPixelMadPerUsd, 9.78);
        const sale = await request(app).post("/api/products").set(admin()).send({ ...payload(), price: 100, compareAtPrice: 150, freeShipping: true });
        assert.equal(sale.status, 201);
        const ordinary = await request(app).post("/api/products").set(admin()).send(payload());
        assert.equal(ordinary.status, 201);
        assert.equal((await request(app).put("/api/products/" + sale.body.data.id).set(admin()).send({ compareAtPrice: 90 })).status, 400);
        assert.equal((await prisma.product.findUnique({ where: { id: sale.body.data.id } })).compareAtPrice, 150);
        const body = { ...checkout(), aiServiceConsent: false, crmConsent: false, expectedTotal: 200, items: [
            { productId: sale.body.data.id, variantId: sale.body.data.variants[0].id, quantity: 1, price: 0.01 },
            { productId: ordinary.body.data.id, variantId: ordinary.body.data.variants[0].id, quantity: 1 }
        ] };
        assert.equal((await request(app).post("/api/orders").set("Idempotency-Key", key()).send({ ...body, items: [{ ...body.items[1], freeShipping: true }] })).status, 400);
        const order = await request(app).post("/api/orders").set("Idempotency-Key", key()).send(body);
        assert.equal(order.status, 201); assert.equal(order.body.data.shippingCost, 0); assert.equal(order.body.data.totalAmount, 200);
        const normal = { ...body, items: [body.items[1]], expectedTotal: 130 };
        const paid = await request(app).post("/api/orders").set("Idempotency-Key", key()).send(normal);
        assert.equal(paid.status, 201); assert.equal(paid.body.data.shippingCost, 30);
        const threshold = await request(app).post("/api/orders").set("Idempotency-Key", key()).send({ ...normal, expectedTotal: 500, items: [{ ...body.items[1], quantity: 5 }] });
        // Replenish before checking the threshold because the previous order reserved a unit.
        assert.equal(threshold.status, 409);
        await prisma.productVariant.update({ where: { id: ordinary.body.data.variants[0].id }, data: { stock: 5 } });
        const atThreshold = await request(app).post("/api/orders").set("Idempotency-Key", key()).send({ ...normal, expectedTotal: 500, items: [{ ...body.items[1], quantity: 5 }] });
        assert.equal(atThreshold.status, 201); assert.equal(atThreshold.body.data.shippingCost, 0);
    } finally {
        if (initial) {
            const { id, ...data } = initial;
            await prisma.storeSettings.update({ where: { id }, data });
        } else await prisma.storeSettings.deleteMany({ where: { id: "settings" } });
    }
});

test("Quantity offers persist, aggregate variants and aliases, reject stale totals and preserve an idempotent price snapshot", async () => {
    const initial = await prisma.storeSettings.findUnique({ where: { id: "settings" } });
    try {
        await prisma.storeSettings.upsert({ where: { id: "settings" }, create: { id: "settings", shippingCost: 30, freeShippingMin: 190 }, update: { shippingCost: 30, freeShippingMin: 190, directSiteConfirmation: false } });
        const data = payload();
        data.variants.push({ ...data.variants[0], sku: `ALT-${key()}`, color: "#ffffff", colorNameFr: "Blanc", size: "44" } as any);
        const tiers = [{ minQuantity: 2, unitPrice: 80 }, { minQuantity: 3, unitPrice: 70 }];
        assert.equal((await request(app).post("/api/products").send({...data,quantityDiscounts:tiers})).status, 401);
        const create = await request(app).post("/api/products").set(admin()).send({...data,quantityDiscounts:tiers});
        assert.equal(create.status, 201);
        const sale = create.body.data;
        assert.deepEqual((await request(app).get(`/api/products/${sale.slug}`)).body.data.quantityDiscounts, tiers);
        const update = (values: object) => request(app).put(`/api/products/${sale.id}`).set(admin()).send(values);
        for (const bad of [[{minQuantity:2,unitPrice:100}], [{minQuantity:2,unitPrice:80.001}], [{minQuantity:2,unitPrice:80},{minQuantity:2,unitPrice:70}]])
            assert.equal((await update({quantityDiscounts:bad})).status, 400);
        assert.equal((await update({price:75})).status, 400, "changing the base price must revalidate existing tiers");
        assert.equal((await prisma.product.findUnique({where:{id:sale.id}})).price, 100);
        const body = { ...checkout(), crmConsent:false, expectedTotal:190, items:[
            {productId:sale.id, variantId:sale.variants[0].id, quantity:1, price:0.01},
            {productId:sale.slug, variantId:sale.variants[1].sku, quantity:1, price:0.01},
        ] };
        const post = (body: object, id = key()) => request(app).post("/api/orders").set("Idempotency-Key", id).send(body);
        const stockBefore = await prisma.productVariant.findMany({where:{productId:sale.id},orderBy:{id:"asc"}});
        assert.equal((await post({...body,expectedTotal:200})).status, 409);
        assert.deepEqual(await prisma.productVariant.findMany({where:{productId:sale.id},orderBy:{id:"asc"}}), stockBefore, "wrong total rolls back all inventory reservations");
        const id = key(), order = await post(body,id);
        assert.equal(order.status, 201); assert.equal(order.body.data.totalAmount,190); assert.equal(order.body.data.shippingCost,30);
        assert.deepEqual(order.body.data.items.map((i:any)=>i.unitPrice),[80,80]);
        const outbox = await prisma.deskcommOutbox.findUnique({where:{orderId:order.body.data.id}});
        if(outbox){assert.equal(outbox.payload.totalAmount,190);assert.deepEqual(outbox.payload.items.map((i:any)=>i.unitPrice),[80,80]);}
        assert.equal((await update({quantityDiscounts:[{minQuantity:2,unitPrice:60}]})).status,200);
        const replay = await post(body,id);
        assert.equal(replay.body.data.id,order.body.data.id); assert.equal(replay.body.data.totalAmount,190);
        assert.equal(await prisma.order.count({where:{idempotencyKey:id}}),1);
        assert.equal((await post(body)).status,409,"old displayed offer requires customer review before charging the new total");
        assert.equal((await update({quantityDiscounts:tiers})).status,200);
        const third = await post({...body,expectedTotal:210,items:[...body.items,{...body.items[0],quantity:1}]});
        assert.equal(third.status,201); assert.equal(third.body.data.shippingCost,0);
        assert.equal(third.body.data.items.every((i:any)=>i.unitPrice===70),true,"split duplicate rows use the same product quantity");
        assert.equal((await update({quantityDiscounts:[]})).status,200);
        const normal = await post({...body,expectedTotal:130,items:[body.items[0]]});
        assert.equal(normal.status,201); assert.equal(normal.body.data.items[0].unitPrice,100);
        assert.equal(order.body.data.items[0].unitPrice,80,"removing offers never rewrites old orders");
    } finally {
        if(initial){const {id,...data}=initial;await prisma.storeSettings.update({where:{id},data});}
        else await prisma.storeSettings.deleteMany({where:{id:"settings"}});
    }
});

test("Manual offers never extend to an unconfigured quantity, and old order snapshots stay immutable", async () => {
    const input = payload();
    input.variants[0].stock = 10;
    const created = await request(app).post("/api/products").set(admin()).send({
        ...input, price: 230, freeShipping: true,
        quantityDiscounts: [{ minQuantity: 2, unitPrice: 200, totalPrice: 400 }],
    });
    assert.equal(created.status, 201);
    const sale = created.body.data, variant = sale.variants[0];
    const body = { ...checkout(), crmConsent: false, expectedTotal: 690,
        items: [{ productId: sale.id, variantId: variant.id, quantity: 3 }] };
    const post = (body: object, id = key()) => request(app).post("/api/orders").set("Idempotency-Key", id).send(body);
    assert.equal((await post({ ...body, expectedTotal: 600 })).status, 409, "an extrapolated total is refused");
    assert.equal((await prisma.productVariant.findUnique({ where: { id: variant.id } })).stock, 10);
    const id = key(), normal = await post(body, id);
    assert.equal(normal.status, 201);
    assert.equal(normal.body.data.totalAmount, 690);
    assert.equal(normal.body.data.items.every((item: any) => item.unitPrice === 230), true);
    const outbox = await prisma.deskcommOutbox.findUnique({ where: { orderId: normal.body.data.id } });
    if (outbox) assert.equal(outbox.payload.totalAmount, 690);
    assert.equal((await request(app).put(`/api/products/${sale.id}`).set(admin()).send({
        quantityDiscounts: [{ minQuantity: 2, unitPrice: 200, totalPrice: 400 }, { minQuantity: 3, unitPrice: 650 / 3, totalPrice: 650 }],
    })).status, 200, "each exact quantity can have an independently entered price");
    const manual = await post({ ...body, expectedTotal: 650 });
    assert.equal(manual.status, 201);
    assert.equal(manual.body.data.totalAmount, 650);
    const replay = await post(body, id);
    assert.equal(replay.body.data.id, normal.body.data.id);
    assert.equal(replay.body.data.totalAmount, 690);
    assert.equal(await prisma.order.count({ where: { idempotencyKey: id } }), 1);
});

test("Exact pack totals keep whole-cent order/CRM snapshots, one order and correct cancellation stock", async()=>{
    const tiers=[{minQuantity:3,totalPrice:500,unitPrice:500/3}];
    const created=await request(app).post("/api/products").set(admin()).send({...payload(),price:200,freeShipping:true,quantityDiscounts:tiers});
    assert.equal(created.status,201);
    const sale=created.body.data, variant=sale.variants[0];
    const update=(quantityDiscounts:unknown)=>request(app).put(`/api/products/${sale.id}`).set(admin()).send({quantityDiscounts});
    for(const bad of [
        [{minQuantity:3,totalPrice:500,unitPrice:166}],
        [{minQuantity:3,totalPrice:500.001,unitPrice:500.001/3}],
        [{minQuantity:2,totalPrice:500,unitPrice:250}],
    ]) assert.equal((await update(bad)).status,400);
    const body={...checkout(),crmConsent:false,expectedTotal:500,items:[{productId:sale.id,variantId:variant.id,quantity:3,price:0.01}]};
    const id=key();
    const result=await request(app).post("/api/orders").set("Idempotency-Key",id).send(body);
    assert.equal(result.status,201,JSON.stringify(result.body));
    const order=result.body.data;
    assert.equal(order.totalAmount,500);assert.equal(order.shippingCost,0);
    assert.equal(order.items.reduce((n:number,i:any)=>n+Math.round(i.unitPrice*100)*i.quantity,0),50000);
    assert.equal(order.items.reduce((n:number,i:any)=>n+i.quantity,0),3);
    assert.deepEqual(order.items.map((i:any)=>[i.quantity,i.unitPrice]),[[2,166.67],[1,166.66]]);
    const outbox=await prisma.deskcommOutbox.findUnique({where:{orderId:order.id}});
    if(outbox){assert.equal(outbox.payload.totalAmount,500);assert.equal(outbox.payload.items.reduce((n:number,i:any)=>n+Math.round(i.unitPrice*100)*i.quantity,0),50000);}
    assert.equal((await update([{minQuantity:2,totalPrice:400,unitPrice:200}])).status,200,"standard totals are valid");
    const replay=await request(app).post("/api/orders").set("Idempotency-Key",id).send(body);
    assert.equal(replay.body.data.id,order.id);assert.equal(replay.body.data.totalAmount,500);
    assert.equal(await prisma.order.count({where:{idempotencyKey:id}}),1);
    for(let i=0;i<2;i++)assert.equal((await request(app).patch(`/api/orders/${order.id}/status`).set(admin()).send({status:"CANCELLED"})).status,200);
    assert.equal((await prisma.productVariant.findUnique({where:{id:variant.id}})).stock,variant.stock);
});

test("Order trash is admin-only, reversible, atomic and preserves commerce records", async () => {
    const create = (extra: object = {}) =>
        prisma.order.create({
            data: {
                customerName: "TRASH FIXTURE",
                paymentMethod: "COD",
                paymentStatus: "PENDING",
                totalAmount: 100,
                status: "CANCELLED",
                ...extra,
            },
        });
    // Missing optional fields represent historical MongoDB records.
    const cancelled = await create();
    const active = await create({ status: "PENDING", inventoryReserved: true });
    const reserved = await create({ inventoryReserved: true });
    const stock = await prisma.productVariant.findMany();
    const outbox = await prisma.deskcommOutbox.findMany();
    const post = (ids: string[], restore = false) =>
        request(app).post("/api/orders/trash").set(admin()).send({ ids, restore });
    assert.equal(
        (
            await request(app)
                .post("/api/orders/trash")
                .send({ ids: [cancelled.id] })
        ).status,
        401,
    );
    const customerToken = jwt.sign(
        { id: "123456789012345678901234", role: "CUSTOMER" },
        process.env.JWT_SECRET!,
    );
    assert.equal(
        (
            await request(app)
                .post("/api/orders/trash")
                .set("Authorization", `Bearer ${customerToken}`)
                .send({ ids: [cancelled.id] })
        ).status,
        403,
    );
    assert.equal((await post([cancelled.id, active.id])).status, 409);
    assert.equal((await post([reserved.id])).status, 409);
    assert.equal((await post([cancelled.id, "000000000000000000000001"])).status, 404);
    assert.equal((await prisma.order.findUnique({ where: { id: cancelled.id } })).deletedAt, null);
    const before = (await request(app).get("/api/orders?limit=100").set(admin())).body.total;
    assert.equal((await request(app).get("/api/orders?trash=invalid").set(admin())).status, 400);
    const moved = await post([cancelled.id, cancelled.id]);
    assert.equal(moved.status, 200);
    assert.equal(moved.body.count, 1);
    assert.equal((await post([cancelled.id])).body.count, 0);
    const visible = await request(app).get("/api/orders?limit=100").set(admin());
    assert.equal(visible.body.total, before - 1);
    assert.ok(!visible.body.data.some((o: any) => o.id === cancelled.id));
    const trash = await request(app).get("/api/orders?trash=true&limit=100").set(admin());
    assert.ok(trash.body.data.some((o: any) => o.id === cancelled.id));
    assert.ok(!trash.body.data.some((o: any) => o.id === active.id));
    assert.equal(
        (await prisma.order.findUnique({ where: { id: cancelled.id } })).status,
        "CANCELLED",
    );
    assert.equal((await post([cancelled.id], true)).body.count, 1);
    assert.equal((await post([cancelled.id], true)).body.count, 0);
    const restored = await request(app).get("/api/orders?limit=100").set(admin());
    assert.equal(restored.body.total, before);
    assert.ok(restored.body.data.some((o: any) => o.id === cancelled.id));
    assert.equal(await prisma.orderEvent.count({ where: { orderId: cancelled.id } }), 2);
    assert.deepEqual(await prisma.productVariant.findMany(), stock);
    assert.deepEqual(await prisma.deskcommOutbox.findMany(), outbox);
});

test("Direct site confirmation is opt-in, persisted, server-enforced and never rewrites history", async () => {
    const initial = await prisma.storeSettings.findUnique({ where: { id: "settings" } });
    const history = await prisma.order.findMany({ orderBy: { id: "asc" } });
    const oldJobs = await prisma.deskcommOutbox.findMany({ orderBy: { id: "asc" } });
    const customer = jwt.sign({ id: "123456789012345678901234", role: "CUSTOMER" }, process.env.JWT_SECRET!);
    const settings = (value: boolean) => request(app).put("/api/settings").set(admin()).send({ directSiteConfirmation: value });
    assert.equal((await request(app).get("/api/settings")).body.data.directSiteConfirmation, false);
    assert.equal((await request(app).put("/api/settings").send({ directSiteConfirmation: true })).status, 401);
    assert.equal((await request(app).put("/api/settings").set("Authorization", `Bearer ${customer}`).send({ directSiteConfirmation: true })).status, 403);
    assert.equal((await request(app).put("/api/settings").set(admin()).send({ directSiteConfirmation: "true" })).status, 400);
    const item = await prisma.product.create({ data: { ...payload(), variants: { create: { ...payload().variants[0], stock: 30 } } }, include: { variants: true } });
    const body = { ...checkout(), aiServiceConsent: true, aiServiceConsentVersion: "order-whatsapp-v1-2026-10-19", expectedTotal: 130,
        items: [{ productId: item.id, variantId: item.variants[0].id, quantity: 1 }] };
    const post = (b: any, idempotencyKey = key()) => request(app).post("/api/orders").set("Idempotency-Key", idempotencyKey).send(b);
    try {
        const standard = await post(body);
        assert.equal(standard.status, 201);
        assert.equal(standard.body.data.status, "PENDING");
        assert.equal(standard.body.data.confirmationMethod, null);
        assert.equal(standard.body.data.confirmedAt, null);
        assert.equal(standard.body.data.aiServiceConsent, true);
        assert.equal((await settings(true)).status, 200);
        const publicSettings = (await request(app).get("/api/settings")).body.data;
        assert.equal(publicSettings.directSiteConfirmation, true);
        assert.equal(publicSettings.whatsappAssistanceAvailable, false);
        const beforeRejected = await prisma.order.count();
        const stockBefore = (await prisma.productVariant.findUnique({ where: { id: item.variants[0].id } })).stock;
        assert.equal((await post(body)).status, 409); // A stale checkout cannot silently confirm.
        const direct = { ...body, confirmationMode: "SITE", customer: { ...body.customer, phone: "0600000099" } };
        assert.equal((await post({ ...direct, expectedTotal: 0.01 })).status, 409);
        assert.equal((await post({ ...direct, status: "CONFIRMED" })).status, 400);
        assert.equal(await prisma.order.count(), beforeRejected);
        assert.equal((await prisma.productVariant.findUnique({ where: { id: item.variants[0].id } })).stock, stockBefore);
        const repeatKey = key();
        const responses = await Promise.all(Array.from({ length: 4 }, () => post(direct, repeatKey)));
        assert.ok(responses.every(r => [200, 201].includes(r.status)), JSON.stringify(responses.map(r => r.body)));
        const ids = new Set(responses.map(r => r.body.data.id));
        assert.equal(ids.size, 1);
        const saved = responses[0].body.data;
        assert.equal(saved.status, "CONFIRMED");
        assert.equal(saved.paymentStatus, "PENDING");
        assert.equal(saved.confirmationMethod, "SITE");
        assert.ok(Number.isFinite(Date.parse(saved.confirmedAt)));
        assert.equal(saved.aiServiceConsent, false); // Even a stale/malicious consent is not forwarded.
        assert.equal(saved.aiServiceConsentAt, null);
        assert.equal(await prisma.order.count(), beforeRejected + 1);
        assert.equal((await prisma.productVariant.findUnique({ where: { id: item.variants[0].id } })).stock, stockBefore - 1);
        assert.equal(await prisma.orderEvent.count({ where: { orderId: saved.id } }), 1);
        const job = await prisma.deskcommOutbox.findUnique({ where: { orderId: saved.id } });
        assert.ok(job, "Other CRM delivery is still queued");
        assert.equal(job.payload.status, "CONFIRMED");
        assert.equal(job.payload.confirmationMethod, "SITE");
        assert.equal(job.payload.confirmedAt, saved.confirmedAt);
        assert.equal(job.payload.confirmationRequired, false);
        assert.equal(job.payload.aiServiceConsent, false);
        assert.equal((await request(app).get("/api/orders?limit=100").set(admin())).body.data.find((o: any) => o.id === saved.id).confirmedAt, saved.confirmedAt);
        const secret = "cb".repeat(32);
        await request(app).put("/api/integrations/deskcomm").set(admin()).send({ enabled: true, signingSecret: secret }).expect(200);
        const { sendOrderToDeskcomm } = await import("../backend/src/lib/deskcomm-crm");
        failDelivery = false;
        await sendOrderToDeskcomm({ ...job.payload, aiServiceConsent: true, aiServiceConsentVersion: body.aiServiceConsentVersion, phone: body.customer.phone });
        const received = receipts.at(-1)!;
        const delivered = JSON.parse(received.body);
        assert.equal(delivered.confirmation_method, "SITE");
        assert.equal(delivered.confirmation_required, false);
        assert.equal(delivered.ai_service_consent, false);
        assert.equal(delivered.aiConsent, false);
        assert.equal(delivered.confirmed_at, saved.confirmedAt);
        assert.equal(delivered.submission_status, "completed");
        assert.equal(received.signature, createHmac("sha256", secret).update(received.body).digest("hex"));
        assert.equal((await settings(false)).status, 200);
        assert.equal((await request(app).get("/api/settings")).body.data.directSiteConfirmation, false);
        const replay = await post(direct, repeatKey); // Frozen receipt survives a setting change.
        assert.equal(replay.status, 200);
        assert.equal(replay.body.data.confirmedAt, saved.confirmedAt);
        assert.equal((await post(direct)).status, 409);
        const normalAgain = await post(body);
        assert.equal(normalAgain.status, 201);
        assert.equal(normalAgain.body.data.status, "PENDING");
        assert.equal(normalAgain.body.data.aiServiceConsent, true);
        assert.equal(normalAgain.body.data.confirmationMethod, null);
        await request(app).patch(`/api/orders/${saved.id}/status`).set(admin()).send({ status: "SHIPPED" }).expect(200);
        assert.equal((await prisma.order.findUnique({ where: { id: saved.id } })).confirmedAt.toISOString(), saved.confirmedAt);
        assert.deepEqual(await prisma.order.findMany({ where: { id: { in: history.map((o: any) => o.id) } }, orderBy: { id: "asc" } }), history);
        assert.deepEqual(await prisma.deskcommOutbox.findMany({ where: { id: { in: oldJobs.map((o: any) => o.id) } }, orderBy: { id: "asc" } }), oldJobs);
    } finally {
        if (initial) { const { id, ...data } = initial; await prisma.storeSettings.update({ where: { id }, data }); }
        else await prisma.storeSettings.deleteMany({ where: { id: "settings" } });
    }
});

test("Olivraison opt-in, encrypted config, no historical replay, direct/CRM enqueue and automated shipment lifecycle", async () => {
    const { processOlivraisonQueue } = await import("../backend/src/lib/olivraison");
    const { transitionOrderStatus } = await import("../backend/src/lib/order-lifecycle");
    const { CarrierError } = await import("../backend/src/lib/olivraison-api");
    const url = "/api/integrations/olivraison";
    const options = { enabled: false, autoPickup: true, apiKey: "isolated-carrier-api", secretKey: "isolated-carrier-secret",
        pickupAddress: { company: "Test", streetAddress: "Adresse fictive", city: "Rabat", phone: "+212600000099" }, cityMapping: {} };
    const put = (body: any) => request(app).put(url).set(admin()).send(body);
    const newOrder = async (direct = true) => {
        await prisma.storeSettings.upsert({ where: { id: "settings" }, create: { id: "settings", directSiteConfirmation: direct }, update: { directSiteConfirmation: direct } });
        product = (await request(app).post("/api/products").set(admin()).send(payload())).body.data;
        const r = await request(app).post("/api/orders").set("Idempotency-Key", key()).send({ ...checkout(), ...(direct ? { confirmationMode: "SITE" } : {}) });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        return r.body.data;
    };
    try {
        assert.equal((await request(app).get(url)).status, 401);
        assert.equal((await request(app).put(url).send(options)).status, 401);
        assert.equal((await request(app).get(url).set(admin())).body.data.enabled, false);
        assert.equal((await put(options)).status, 200);
        const saved = await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
        assert.doesNotMatch(saved.credentials, /isolated-carrier/);
        assert.doesNotMatch(JSON.stringify((await request(app).get(url).set(admin())).body), /isolated-carrier/);
        const historical = await newOrder();
        assert.equal(await prisma.olivraisonShipment.count(), 0);
        assert.equal((await put({ ...options, apiKey: undefined, secretKey: undefined, enabled: true })).status, 200);
        await transitionOrderStatus(historical.id, "SHIPPED");
        assert.equal(await prisma.olivraisonShipment.count(), 0);
        const order = await newOrder();
        assert.equal(await prisma.olivraisonShipment.count(), 1);
        const remote = { trackingID: "ISO-TRACK-1", partnerTrackingID: order.id, status: "CREATED" };
        const calls: any[] = []; let failCreate = true;
        const fake = async (path: string, method = "GET", body?: any) => {
            calls.push({ path, method, body });
            if (path === "/cities") return [{ name: "Rabat", price: 30 }];
            if (path === "/package/new") {
                if (failCreate) { failCreate = false; throw new CarrierError("Timeout", true); }
                return remote;
            }
            if (path === "/package/ISO-TRACK-1") return { ...remote };
            if (path === "/package/status") { remote.status = "CONFIRMED"; return { message: "Success" }; }
            if (path === "/pickup") {
                assert.deepEqual(body.packages, [remote.trackingID]); remote.status = "PICKUP";
                return { packages: [{ ...remote }], miniStickerFilePath: "/sticker.pdf", slipFilePath: "/slip.pdf" };
            }
            throw new Error("Unexpected mock request");
        };
        await processOlivraisonQueue(fake);
        let shipment = await prisma.olivraisonShipment.findUnique({ where: { id: order.id } });
        assert.equal(shipment.state, "RETRY");
        await prisma.olivraisonShipment.update({ where: { id: order.id }, data: { nextAttemptAt: new Date(0) } });
        await Promise.all([processOlivraisonQueue(fake), processOlivraisonQueue(fake)]);
        shipment = await prisma.olivraisonShipment.findUnique({ where: { id: order.id } });
        assert.equal(shipment.carrierStatus, "PICKUP"); assert.equal(shipment.state, "ACTIVE");
        assert.equal(shipment.slipUrl, "https://partners.olivraison.com/slip.pdf");
        const creates = calls.filter(c => c.path === "/package/new");
        assert.equal(creates.length, 2); assert.deepEqual(creates[0].body, creates[1].body);
        assert.equal(creates[0].body.orderId, order.id); assert.equal(creates[0].body.price, order.totalAmount);
        assert.equal(calls.filter(c => c.path === "/pickup").length, 1);
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "CONFIRMED");
        for (const status of ["TRANSIT", "DELIVERED"]) {
            remote.status = status;
            await prisma.olivraisonShipment.update({ where: { id: order.id }, data: { nextAttemptAt: new Date(0) } });
            await processOlivraisonQueue(fake);
        }
        const delivered = await prisma.order.findUnique({ where: { id: order.id } });
        assert.equal(delivered.status, "DELIVERED"); assert.equal(delivered.paymentStatus, "PENDING");
        assert.equal((await prisma.olivraisonShipment.findUnique({ where: { id: order.id } })).state, "DONE");
        const pending = await newOrder(false);
        assert.equal(await prisma.olivraisonShipment.count(), 1);
        await transitionOrderStatus(pending.id, "CONFIRMED");
        await transitionOrderStatus(pending.id, "CONFIRMED");
        assert.equal(await prisma.olivraisonShipment.count(), 2);
        await put({ ...options, apiKey: undefined, secretKey: undefined, enabled: false });
        let invoked = false; await processOlivraisonQueue(async () => { invoked = true; }); assert.equal(invoked, false);
    } finally {
        await prisma.olivraisonIntegration.updateMany({ data: { enabled: false } });
        await prisma.storeSettings.updateMany({ data: { directSiteConfirmation: false } });
    }
});

test("Olivraison reconciles an uncertain pickup without issuing it twice and stops cancelled orders", async () => {
    const { processOlivraisonQueue } = await import("../backend/src/lib/olivraison");
    const { CarrierError } = await import("../backend/src/lib/olivraison-api");
    const { transitionOrderStatus } = await import("../backend/src/lib/order-lifecycle");
    await prisma.olivraisonShipment.updateMany({ data: { state: "DONE" } });
    await prisma.olivraisonIntegration.update({ where: { id: "olivraison" }, data: { enabled: true, activatedAt: new Date(), autoPickup: true } });
    await prisma.storeSettings.update({ where: { id: "settings" }, data: { directSiteConfirmation: true } });
    const create = async () => {
        product = (await request(app).post("/api/products").set(admin()).send(payload())).body.data;
        const r = await request(app).post("/api/orders").set("Idempotency-Key", key()).send({ ...checkout(), confirmationMode: "SITE" });
        assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.data;
    };
    try {
        const order = await create(); let status = "CREATED", pickups = 0;
        const fake = async (path: string) => {
            if (path === "/cities") return [{ name: "Rabat" }];
            if (path === "/package/new") return { trackingID: "UNCERTAIN", status };
            if (path === "/package/UNCERTAIN") return { trackingID: "UNCERTAIN", partnerTrackingID: order.id, status };
            if (path === "/package/status") { status = "CONFIRMED"; return {}; }
            if (path === "/pickup") { pickups++; status = "PICKUP"; throw new CarrierError("Timeout", true); }
            throw new Error("Unexpected request");
        };
        await processOlivraisonQueue(fake);
        await prisma.olivraisonShipment.update({ where: { id: order.id }, data: { nextAttemptAt: new Date(0) } });
        await processOlivraisonQueue(fake);
        assert.equal(pickups, 1);
        const shipment = await prisma.olivraisonShipment.findUnique({ where: { id: order.id } });
        assert.equal(shipment.state, "ATTENTION"); assert.equal(shipment.carrierStatus, "PICKUP");
        const cancelled = await create(); await transitionOrderStatus(cancelled.id, "CANCELLED");
        let network = 0; await processOlivraisonQueue(async () => { network++; });
        assert.equal(network, 0);
        assert.equal((await prisma.olivraisonShipment.findUnique({ where: { id: cancelled.id } })).state, "ATTENTION");
    } finally {
        await prisma.olivraisonIntegration.updateMany({ data: { enabled: false } });
        await prisma.storeSettings.updateMany({ data: { directSiteConfirmation: false } });
    }
});


test("carrier removal retires unfinished parcels, erases secrets and cannot replay history after reconnect", async () => {
    const url = "/api/integrations/olivraison";
    await request(app).delete(url).expect(401);
    const before = await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
    assert.ok(before);
    const pending = await prisma.olivraisonShipment.findFirst({ where: { state: { not: "DONE" } } });
    assert.ok(pending);
    await prisma.olivraisonShipment.update({ where: { id: pending.id }, data: { leaseToken: "isolated-running", lockedUntil: new Date(Date.now() + 300000) } });
    await request(app).delete(url).set(admin()).expect(409);
    assert.deepEqual(await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } }), before);
    await prisma.olivraisonShipment.update({ where: { id: pending.id }, data: { leaseToken: null, lockedUntil: new Date(0) } });
    const history = await prisma.olivraisonShipment.findMany({ orderBy: { id: "asc" } });
    const orders = await prisma.order.findMany({ orderBy: { id: "asc" } });
    for (let i = 0; i < 2; i++) {
        const result = await request(app).delete(url).set(admin()).expect(200);
        assert.equal(result.body.data.saved, false);
        assert.equal(result.body.data.configured, false);
        assert.equal(result.body.data.enabled, false);
    }
    assert.equal(await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } }), null);
    const retired = await prisma.olivraisonShipment.findMany({ orderBy: { id: "asc" } });
    assert.equal(retired.length, history.length);
    for (let i = 0; i < retired.length; i++) {
        assert.equal(retired[i].state, history[i].state === "DONE" ? "DONE" : "DISCONNECTED");
        assert.equal(retired[i].trackingId, history[i].trackingId);
        assert.equal(retired[i].slipUrl, history[i].slipUrl);
    }
    assert.deepEqual(await prisma.order.findMany({ orderBy: { id: "asc" } }), orders);
    await request(app).post(`${url}/shipments/${pending.id}/retry`).set(admin()).expect(409);
    const config = { enabled: true, autoPickup: false, apiKey: "isolated-new", secretKey: "isolated-new-secret", pickupAddress: { company: "Test", streetAddress: "Adresse fictive", city: "Rabat", phone: "+212600000099" }, cityMapping: {} };
    await request(app).put(url).set(admin()).send(config).expect(200);
    const { processOlivraisonQueue } = await import("../backend/src/lib/olivraison");
    let invoked = false;
    await processOlivraisonQueue(async () => { invoked = true; });
    assert.equal(invoked, false);
    assert.deepEqual(await prisma.olivraisonShipment.findMany({ orderBy: { id: "asc" } }), retired);
    await request(app).put(url).set(admin()).send({ ...config, apiKey: "isolated-next" }).expect(200);
    await request(app).delete(url).set(admin()).expect(200);
});


test("Dashboard controls signed transactional assistance without creating customer consent or replaying history", async () => {
    const previous = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    const historical = await prisma.deskcommOutbox.findMany();
    const endpoint = "/api/integrations/deskcomm";
    const update = (flag: boolean) => request(app).put(endpoint).set(admin()).send({ enabled: true, orderAssistanceEnabled: flag });
    try {
        assert.equal((await request(app).put(endpoint).send({ enabled: true, orderAssistanceEnabled: true })).status, 401);
        const customer = jwt.sign({ id: "123456789012345678901234", role: "CUSTOMER" }, process.env.JWT_SECRET!);
        assert.equal((await request(app).put(endpoint).set("Authorization", `Bearer ${customer}`).send({ enabled: true, orderAssistanceEnabled: true })).status, 403);
        assert.equal((await request(app).put(endpoint).set(admin()).send({ enabled: true, orderAssistanceEnabled: "true" })).status, 400);
        await request(app).put(endpoint).set(admin()).send({ enabled: true, signingSecret: "cb".repeat(32), orderAssistanceEnabled: true }).expect(200);
        assert.equal((await request(app).get(endpoint).set(admin())).body.data.orderAssistanceEnabled, true);
        const p = await prisma.product.create({ data: { ...payload(), variants: { create: { ...payload().variants[0], stock: 20 } } }, include: { variants: true } });
        const body = { ...checkout(), aiServiceConsent: false, items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 1 }] };
        const k = key();
        const send = (value: any, idem = key()) => request(app).post("/api/orders").set("Idempotency-Key", idem).send(value);
        assert.equal((await send({ ...body, orderServiceRequested: true })).status, 400);
        const results = await Promise.all([send(body, k), send(body, k)]);
        assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
        const order = results[0].body.data;
        assert.equal(order.id, results[1].body.data.id);
        assert.equal(order.orderServiceRequested, true);
        assert.equal(order.orderServicePolicyVersion, "store-order-service-v1-2026-10-19");
        assert.ok(order.orderServiceRequestedAt);
        assert.equal(order.aiServiceConsent, false);
        assert.equal(order.aiServiceConsentVersion, null);
        assert.equal(order.aiServiceConsentAt, null);
        const job = await prisma.deskcommOutbox.findUnique({ where: { orderId: order.id } });
        assert.equal(job.payload.orderServiceRequested, true);
        const { sendOrderToDeskcomm } = await import("../backend/src/lib/deskcomm-crm");
        failDelivery = false;
        await sendOrderToDeskcomm(job.payload);
        let received = JSON.parse(receipts.at(-1)!.body);
        assert.equal(received.order_service_requested, true);
        assert.equal(received.ai_service_consent, null);
        assert.equal(received.aiConsent, false);
        assert.equal(received.order_service_policy_version, order.orderServicePolicyVersion);
        await update(false).expect(200);
        await sendOrderToDeskcomm(job.payload); // A queued instruction is stopped at delivery too.
        received = JSON.parse(receipts.at(-1)!.body);
        assert.equal(received.order_service_requested, false);
        assert.equal(received.ai_service_consent, null);
        const forged = await send({ ...body, aiServiceConsent: true, aiServiceConsentVersion: "order-whatsapp-v1-2026-10-19" });
        assert.equal(forged.status, 201);
        assert.equal(forged.body.data.orderServiceRequested, false);
        assert.equal(forged.body.data.aiServiceConsent, false);
        const replay = await send(body, k);
        assert.equal(replay.status, 200);
        assert.equal(replay.body.data.id, order.id);
        assert.equal(replay.body.data.orderServiceRequested, true); // Frozen receipt.
        assert.equal(await prisma.deskcommOutbox.count({ where: { orderId: order.id } }), 1);
        await update(true).expect(200);
        const offJob = await prisma.deskcommOutbox.findUnique({ where: { orderId: forged.body.data.id } });
        await sendOrderToDeskcomm(offJob.payload);
        assert.equal(JSON.parse(receipts.at(-1)!.body).order_service_requested, false);
        await prisma.storeSettings.upsert({ where: { id: "settings" }, create: { id: "settings", directSiteConfirmation: true }, update: { directSiteConfirmation: true } });
        const direct = await send({ ...body, confirmationMode: "SITE" });
        assert.equal(direct.status, 201);
        assert.equal(direct.body.data.orderServiceRequested, false);
        await prisma.storeSettings.update({ where: { id: "settings" }, data: { directSiteConfirmation: false } });
        for (const old of historical) assert.deepEqual((await prisma.deskcommOutbox.findUnique({ where: { id: old.id } })).payload, old.payload);
    } finally {
        if (previous) { const { id, updatedAt, ...data } = previous; await prisma.deskcommIntegration.update({ where: { id }, data }); }
        else await prisma.deskcommIntegration.deleteMany({ where: { id: "deskcomm" } });
        await prisma.storeSettings.updateMany({ where: { id: "settings" }, data: { directSiteConfirmation: false } });
    }
});
