import "dotenv/config";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import "express-async-errors";

import { authRoutes } from "./routes/auth.routes";
import { productRoutes } from "./routes/product.routes";
import { categoryRoutes } from "./routes/category.routes";
import { orderRoutes, notificationRoutes } from "./routes/order.routes";
import { paymentRoutes } from "./routes/payment.routes";
import { addressRoutes } from "./routes/address.routes";
import { settingsRoutes } from "./routes/settings.routes";
import { telegramRoutes } from "./routes/telegram.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { syncSheetsToDatabase } from "./lib/notifications";
import { ensureProductionData } from "./lib/seedAdmin";
import { processOrderWebhooks } from "./lib/order-webhook";

const app: Application = express();
const PORT = process.env.PORT ?? 4000;

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
    cors({
        origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
        credentials: true,
    })
);
app.use(morgan("dev"));

// raw body for Stripe webhooks — must come BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
    res.json({ message: "Imad Store API is running. Please use /api for endpoints." });
});

// ─── One-time Seed Trigger (manual, safe to call anytime) ────────────────────
app.get("/api/seed", async (req, res) => {
    try {
        const clean = req.query.clean === "true";
        await ensureProductionData(clean);
        res.json({ success: true, message: `Production data seeded/verified successfully. (clean=${clean})` });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV !== "production";
const orderRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // In development: effectively unlimited (10 000 requests).
    // In production: strict 50 requests per 15 min per IP.
    max: IS_DEV ? 10_000 : 50,
    skip: () => IS_DEV, // Skip the limiter entirely in dev — no 429s during testing
    message: "تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً.",
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRateLimiter, orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/settings", settingsRoutes);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`🚀 Imad Store API running on http://localhost:${PORT}`);
    // Auto-seed admin + sample data on every boot (idempotent — safe no-op if data is valid)
    await ensureProductionData();
});

// ─── Background Workers ──────────────────────────────────────────────────────
// Google Sheets → DB sync (polls every 30s)
setInterval(() => {
    syncSheetsToDatabase().catch((err) =>
        console.error("Sheets → DB sync worker error:", err)
    );
}, 30_000);

export default app;

processOrderWebhooks().catch(console.error);
setInterval(()=>processOrderWebhooks().catch(console.error),20000);
