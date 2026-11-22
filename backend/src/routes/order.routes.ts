import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    createOrder,
    moveOrdersToTrash,
    getOrder,
    getOrderHistory,
    getAdminOrder,
    listOrders,
    exportOrders,
    updateOrderStatus,
    syncOrderCarrierStatus,
    getAdminNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../controllers/order.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

export const orderRoutes: IRouter = Router();
orderRoutes.param("id", validateObjectId);

// ─── Public (guest checkout — no auth required) ────────────────────────────
orderRoutes.post("/", createOrder); // guest checkout
// Register before the public /:id route and its identifier validation.
orderRoutes.get("/export.csv", authenticate, requireAdmin, exportOrders);
orderRoutes.get("/:id", getOrder); // order tracking by ID

// ─── Admin ────────────────────────────────────────────────────────────────
orderRoutes.get("/", authenticate, requireAdmin, listOrders);
orderRoutes.get("/:id/admin-details", authenticate, requireAdmin, getAdminOrder);
orderRoutes.get("/:id/history", authenticate, requireAdmin, getOrderHistory);
orderRoutes.post("/trash", authenticate, requireAdmin, moveOrdersToTrash);
orderRoutes.patch("/:id/status", authenticate, requireAdmin, updateOrderStatus);
orderRoutes.post("/:id/olivraison-sync", authenticate, requireAdmin, syncOrderCarrierStatus);

// Admin notifications (polled by dashboard every 5–10s)
export const notificationRoutes: IRouter = Router();
notificationRoutes.param("id", validateObjectId);
notificationRoutes.get("/", authenticate, requireAdmin, getAdminNotifications);
notificationRoutes.patch("/:id/read", authenticate, requireAdmin, markNotificationRead);
notificationRoutes.post("/read-all", authenticate, requireAdmin, markAllNotificationsRead);
