import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    createOrder,
    getOrder,
    listOrders,
    updateOrderStatus,
    getAdminNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../controllers/order.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

export const orderRoutes: IRouter = Router();
orderRoutes.param("id", validateObjectId);

// ─── Public (guest checkout — no auth required) ────────────────────────────
orderRoutes.post("/", createOrder);                              // guest checkout
orderRoutes.get("/:id", getOrder);                              // order tracking by ID

// ─── Admin ────────────────────────────────────────────────────────────────
orderRoutes.get("/", authenticate, requireAdmin, listOrders);
orderRoutes.patch("/:id/status", authenticate, requireAdmin, updateOrderStatus);

// Admin notifications (polled by dashboard every 5–10s)
export const notificationRoutes: IRouter = Router();
notificationRoutes.param("id", validateObjectId);
notificationRoutes.get("/", authenticate, requireAdmin, getAdminNotifications);
notificationRoutes.patch("/:id/read", authenticate, requireAdmin, markNotificationRead);
notificationRoutes.post("/read-all", authenticate, requireAdmin, markAllNotificationsRead);
