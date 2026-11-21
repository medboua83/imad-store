import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { createOrderRateLimiters } from "../backend/src/middleware/order-rate-limit";

function fixture(development = false) {
    const app = express();
    app.use("/api/orders", ...createOrderRateLimiters(development));
    app.all("/api/orders", (_req, res) => res.sendStatus(200));
    app.all("/api/orders/:id/status", (_req, res) => res.sendStatus(200));
    return app;
}

test("production dashboard GET/HEAD polling does not consume the order creation budget", async () => {
    const app = fixture();
    for (let n = 0; n < 60; n++) await request(app).get("/api/orders").expect(200);
    for (let n = 0; n < 40; n++) await request(app).head("/api/orders").expect(200);
    for (let n = 0; n < 50; n++) await request(app).post("/api/orders").expect(200);
    const blocked = await request(app).post("/api/orders").expect(429);
    assert.equal(blocked.headers["ratelimit-limit"], "50");
    await request(app).get("/api/orders").expect(200);
});

test("production reads remain bounded and arbitrary credentials do not bypass their budget", async () => {
    const app = fixture();
    for (let n = 0; n < 120; n++)
        await request(app).get("/api/orders").set("Authorization", "Bearer invalid").expect(200);
    const blocked = await request(app).get("/api/orders").expect(429);
    assert.equal(blocked.headers["ratelimit-limit"], "120");
    assert.equal(blocked.body.success, false);
    // A read burst cannot prevent a customer submitting an order from that IP.
    await request(app).post("/api/orders").expect(200);
});

test("creation and status changes retain the same shared production write limit", async () => {
    const app = fixture();
    for (let n = 0; n < 25; n++) await request(app).post("/api/orders").expect(200);
    for (let n = 0; n < 25; n++) await request(app).patch("/api/orders/example/status").expect(200);
    await request(app).patch("/api/orders/example/status").expect(429);
    await request(app).post("/api/orders").expect(429);
    await request(app).get("/api/orders").expect(200);
});

test("development keeps its existing limiter bypass without changing production defaults", async () => {
    const app = fixture(true);
    for (let n = 0; n < 130; n++) await request(app).get("/api/orders").expect(200);
    for (let n = 0; n < 60; n++) await request(app).post("/api/orders").expect(200);
});
