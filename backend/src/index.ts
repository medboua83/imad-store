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
import { deskcommRoutes } from "./routes/deskcomm.routes";
import { telegramRoutes } from "./routes/telegram.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { syncSheetsToDatabase } from "./lib/notifications";
import { processDeskcommOutbox } from "./lib/deskcomm-outbox";
import { ensureProductionData } from "./lib/seedAdmin";

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
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts. Try again later.",
});
app.use("/api/auth/login", loginRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRateLimiter, orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/integrations/deskcomm", deskcommRoutes);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`🚀 Imad Store API running on http://localhost:${PORT}`);
    // Check store data; administrator credentials are never created or reset at startup.
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

// Poll durable CRM outbox independent of the checkout request.
setInterval(() => {
    processDeskcommOutbox().catch((err) => console.error("DeskcommCRM worker failed:", err instanceof Error ? err.name : "UnknownError"));
}, 15000);
