import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
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
const receipts: { key?: string; body: string }[] = [];
let failDelivery = true;
const crm = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
        receipts.push({ key: req.headers["idempotency-key"] as string, body });
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
