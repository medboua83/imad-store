import "dotenv/config";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { receiveDeskcommConfirmation } from "./controllers/deskcomm-status.controller";
import { assertStoreInstallation } from "./lib/store-installation";
import rateLimit from "express-rate-limit";
import "express-async-errors";

import { olivraisonRoutes } from "./routes/olivraison.routes";

import { uploadRoutes, uploadDirectory } from "./routes/upload.routes";
import { analyticsRoutes } from "./routes/analytics.routes";
import { contentRoutes } from "./routes/content.routes";
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

export const app: Application = express();

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
    cors({
        origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
        credentials: true,
    }),
);
app.use(morgan("dev"));
app.use(async (_req, _res, next) => {
    await assertStoreInstallation();
    next();
});

// raw body for Stripe webhooks — must come BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// Signed CRM callbacks must retain exact bytes and never use an administrator session.
app.post(
    "/api/integrations/deskcomm/status-callback",
    rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }),
    express.raw({ type: "application/json", limit: "128kb" }),
    receiveDeskcommConfirmation,
);
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
app.use("/api", (req, res, next) => {
    if (req.headers.authorization || !["GET", "HEAD"].includes(req.method))
        res.setHeader("Cache-Control", "private, no-store");
    next();
});
app.use("/api/content", contentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadRoutes);
app.use(
    "/uploads",
    (req, res, next) => {
        if (!/^\/[a-f0-9]{64}\.webp$/.test(req.path)) return res.sendStatus(404);
        next();
    },
    express.static(uploadDirectory, { dotfiles: "deny", immutable: true, maxAge: "1y" }),
);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRateLimiter, orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/integrations/deskcomm", deskcommRoutes);
app.use("/api/integrations/olivraison", olivraisonRoutes);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
