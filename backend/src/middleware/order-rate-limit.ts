import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Dashboard polling must never exhaust the budget for creating or changing orders. */
export function createOrderRateLimiters(development = process.env.NODE_ENV !== "production") {
    const isRead = (req: Request) => req.method === "GET" || req.method === "HEAD";
    return [
        rateLimit({
            windowMs: 60_000,
            max: 120,
            skip: (req) => development || !isRead(req),
            message: { success: false, error: "Trop de consultations des commandes. Réessayez dans une minute." },
            standardHeaders: true,
            legacyHeaders: false,
        }),
        rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 50,
            skip: (req) => development || isRead(req),
            message: "تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة لاحقاً.",
            standardHeaders: true,
            legacyHeaders: false,
        }),
    ];
}
