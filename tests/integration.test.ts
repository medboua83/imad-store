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
