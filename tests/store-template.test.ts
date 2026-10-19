import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";
import { createProfile } from "../scripts/create-company-store.cjs";
const name = `imad_ci_${randomBytes(8).toString("hex")}`;
if (!/^imad_ci_[a-f0-9]{16}$/.test(process.env.TEST_DATABASE_NAME || ""))
    throw new Error("Isolated runner required");
process.env.DATABASE_URL = `mongodb://127.0.0.1:27017/${name}?replicaSet=rs0`;
const storeId = randomUUID(),
    companyId = randomUUID(),
    pipeline = randomUUID(),
    stage = randomUUID();
process.env.STORE_INSTANCE_ID = storeId;
process.env.CRM_COMPANY_ID = companyId;
let app: any, prisma: any;
const mongo = new MongoClient(process.env.DATABASE_URL);
const admin = () => ({
    Authorization: `Bearer ${jwt.sign({ id: "123456789012345678901234", role: "ADMIN" }, process.env.JWT_SECRET!)}`,
});
before(async () => {
    await mongo.connect();
    ({ app } = await import("../backend/src/app"));
    ({ prisma } = await import("../backend/src/lib/prisma"));
});
after(async () => {
    await prisma?.$disconnect();
    await mongo.db(name).dropDatabase();
    await mongo.close();
});
test("Fresh profiles never copy secrets, identities, clients or products and never overwrite a destination", async () => {
    const root = await mkdtemp(join(tmpdir(), "imad-profile-"));
    try {
        const a = createProfile({
            companyId,
            name: "Boutique A",
            origin: "https://a.example",
            output: join(root, "a"),
        });
        const b = createProfile({
            companyId: randomUUID(),
            name: "Boutique B",
            origin: "https://b.example",
            output: join(root, "b"),
        });
        assert.notEqual(a.storeId, b.storeId);
        assert.notEqual(a.database, b.database);
        const envA = await readFile(join(root, "a/store.env"), "utf8"),
            envB = await readFile(join(root, "b/store.env"), "utf8");
        const secret = (s: string) =>
            s.split("\n").find((l) => l.startsWith("DESKCOMM_ENCRYPTION_KEY="));
        assert.notEqual(secret(envA), secret(envB));
        assert.doesNotMatch(envA, /quickydev|codilabs|WEBHOOK_URL|STATUS_CALLBACK_SECRET/);
        assert.equal((await stat(join(root, "a/store.env"))).mode & 0o777, 0o600);
        assert.throws(() =>
            createProfile({
                companyId,
                name: "Overwrite",
                origin: "https://a.example",
                output: join(root, "a"),
            }),
        );
        assert.throws(() =>
            createProfile({
                companyId,
                name: "Invalid",
                origin: "http://a.example",
                output: join(root, "c"),
            }),
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("Database binds one store/company and initializes unique order indexes before accepting traffic", async () => {
    assert.equal((await request(app).get("/api/products")).status, 200);
    const installation = await prisma.storeInstallation.findUnique({
        where: { id: "installation" },
    });
    assert.equal(installation.storeId, storeId);
    assert.equal(installation.companyId, companyId);
    assert.equal(installation.initialized, true);
    const indexes = await mongo.db(name).collection("orders").indexes();
    assert.equal(indexes.find((i) => i.name === "idempotencyKey_1")?.unique, true);
    process.env.CRM_COMPANY_ID = randomUUID();
    const { readPublicStore } = await import("../backend/src/lib/public-store");
    assert.equal((await readPublicStore("/products")).status, 503);
    assert.equal((await request(app).get("/api/products")).status, 503);
    assert.equal((await request(app).get("/api/integrations/deskcomm").set(admin())).status, 503);
    const { processDeskcommOutbox } = await import("../backend/src/lib/deskcomm-outbox");
    await assert.rejects(processDeskcommOutbox, /autre installation/);
    process.env.CRM_COMPANY_ID = companyId;
    process.env.STORE_INSTANCE_ID = randomUUID();
    assert.equal((await request(app).get("/api/products")).status, 503);
    process.env.STORE_INSTANCE_ID = storeId;
    delete process.env.STORE_INSTANCE_ID;
    delete process.env.CRM_COMPANY_ID;
    assert.equal((await request(app).get("/api/products")).status, 503);
    process.env.STORE_INSTANCE_ID = storeId;
    process.env.CRM_COMPANY_ID = companyId;
    assert.equal((await request(app).get("/api/products")).status, 200);
});
test("Company connection is admin-only, encrypted, immutable in scope and does not expose its secret", async () => {
    const secret = "ef".repeat(32),
        body = { enabled: true, pipeline, stage, field: "pedido_id", secret };
    const endpoint = "/api/integrations/deskcomm/connection";
    assert.equal((await request(app).put(endpoint).send(body)).status, 401);
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ ...body, companyId: randomUUID() })
        ).status,
        400,
    );
    const saved = await request(app).put(endpoint).set(admin()).send(body);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.data.companyId, companyId);
    assert.doesNotMatch(JSON.stringify(saved.body), new RegExp(secret));
    const encrypted = await prisma.deskcommConnection.findUnique({ where: { id: "deskcomm" } });
    assert.ok(encrypted.ciphertext);
    assert.doesNotMatch(encrypted.ciphertext, new RegExp(secret));
    const config = await request(app).get("/api/integrations/deskcomm").set(admin());
    assert.equal(config.body.data.confirmationSync, true);
    assert.doesNotMatch(JSON.stringify(config.body), new RegExp(secret));
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ ...body, pipeline: randomUUID() })
        ).status,
        409,
    );
    const callback = "/api/integrations/deskcomm/status-callback";
    const delivery = randomUUID(),
        t = Math.floor(Date.now() / 1000);
    const event = JSON.stringify({
        event: "lead.stage_changed",
        delivery_id: delivery,
        happened_at: new Date().toISOString(),
        data: {
            to_stage_id: stage,
            lead: {
                id: randomUUID(),
                pipeline_id: randomUUID(),
                stage_id: stage,
                custom_fields: { pedido_id: "123456789012345678901234" },
            },
        },
    });
    const send = (key: string) =>
        request(app)
            .post(callback)
            .set("Content-Type", "application/json")
            .set("X-Webhook-Delivery", delivery)
            .set(
                "X-Webhook-Signature",
                `t=${t},v1=${createHmac("sha256", key).update(`${t}.${delivery}.${event}`).digest("hex")}`,
            )
            .send(event);
    assert.equal((await send("ab".repeat(32))).status, 401);
    assert.equal((await send(secret)).status, 403);
    assert.equal(await prisma.order.count(), 0);
    assert.equal(await prisma.deskcommStatusReceipt.count(), 0);
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ enabled: false, pipeline, stage, field: "pedido_id" })
        ).status,
        200,
    );
    assert.equal((await send(secret)).status, 503);
});
test("A template order confirms once, never changes destination, and cannot be confirmed by another company's key", async () => {
    const endpoint = "/api/integrations/deskcomm";
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ enabled: true, webhookUrl: "http://127.0.0.1:12345/company-a" })
        ).status,
        200,
    );
    const order = await prisma.order.create({ data: { paymentMethod: "COD", totalAmount: 100 } });
    await prisma.deskcommOutbox.create({
        data: { orderId: order.id, payload: {}, status: "SENT" },
    });
    const hook = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    assert.equal(
        (
            await request(app)
                .put(endpoint)
                .set(admin())
                .send({ enabled: true, webhookUrl: "http://127.0.0.1:12345/company-b" })
        ).status,
        409,
    );
    assert.equal(
        (await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } }))
            .webhookCiphertext,
        hook.webhookCiphertext,
    );
    assert.equal(
        (
            await request(app)
                .put(endpoint + "/connection")
                .set(admin())
                .send({ enabled: true, pipeline, stage, field: "pedido_id" })
        ).status,
        200,
    );
    const secret = "ef".repeat(32),
        delivery = randomUUID(),
        t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
        event: "lead.stage_changed",
        delivery_id: delivery,
        happened_at: new Date(Date.now() + 1000).toISOString(),
        data: {
            to_stage_id: stage,
            lead: {
                id: randomUUID(),
                pipeline_id: pipeline,
                stage_id: stage,
                custom_fields: { pedido_id: order.id },
            },
        },
    });
    const send = (key: string) =>
        request(app)
            .post(endpoint + "/status-callback")
            .set("Content-Type", "application/json")
            .set("X-Webhook-Delivery", delivery)
            .set(
                "X-Webhook-Signature",
                `t=${t},v1=${createHmac("sha256", key).update(`${t}.${delivery}.${body}`).digest("hex")}`,
            )
            .send(body);
    assert.equal((await send("ab".repeat(32))).status, 401);
    const results = await Promise.all([send(secret), send(secret)]);
    assert.deepEqual(
        results.map((r) => r.status),
        [200, 200],
    );
    assert.equal(results.filter((r) => r.body.data.changed).length, 1);
    assert.equal(await prisma.order.count(), 1);
    assert.equal(await prisma.deskcommOutbox.count(), 1);
    assert.equal(await prisma.orderEvent.count({ where: { orderId: order.id } }), 1);
    assert.equal(await prisma.deskcommStatusReceipt.count(), 1);
    assert.equal(
        (await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus,
        "PENDING",
    );
});
test("A copied commerce database cannot be adopted as a fresh company", async () => {
    await prisma.storeInstallation.delete({ where: { id: "installation" } }); // disposable isolated fixture only
    assert.equal((await request(app).get("/api/products")).status, 503);
    assert.equal(await prisma.storeInstallation.count(), 0);
});
