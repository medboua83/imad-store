import { validateObjectId } from "../lib/validation";
import { Router, IRouter } from "express";
import {
    createOrder,
    moveOrdersToTrash,
    getOrder,
    getOrderHistory,
    getAdminOrder,
    getCustomerOrderHistory,
    getDispatchBlacklist,
    listOrders,
    exportOrders,
    updateOrderStatus,
    syncOrderCarrierStatus,
    approveOrderCarrierDispatch,
    getAdminNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../controllers/order.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const orderRoutes: IRouter = Router();
orderRoutes.param("id", validateObjectId);

// ─── Public (guest checkout — no auth required) ────────────────────────────
orderRoutes.post("/", createOrder); // guest checkout
// Register before the public /:id route and its identifier validation.
orderRoutes.get("/export.csv", authenticate, requirePermission("orders.export"), exportOrders);
orderRoutes.get("/dispatch-blacklist", authenticate, requirePermission("orders.read"), getDispatchBlacklist);
orderRoutes.get("/:id", getOrder); // order tracking by ID

// ─── Admin ────────────────────────────────────────────────────────────────
orderRoutes.get("/", authenticate, requirePermission("orders.read"), listOrders);
orderRoutes.get("/:id/admin-details", authenticate, requirePermission("orders.read"), getAdminOrder);
orderRoutes.get("/:id/customer-history", authenticate, requirePermission("orders.read"), getCustomerOrderHistory);
orderRoutes.get("/:id/history", authenticate, requirePermission("orders.read"), getOrderHistory);
orderRoutes.post("/trash", authenticate, requirePermission("orders.write"), moveOrdersToTrash);
orderRoutes.patch("/:id/status", authenticate, requirePermission("orders.write"), updateOrderStatus);
orderRoutes.post("/:id/olivraison-approve", authenticate, requirePermission("orders.write"), approveOrderCarrierDispatch);
orderRoutes.post("/:id/olivraison-sync", authenticate, requirePermission("orders.write"), syncOrderCarrierStatus);

// Admin notifications (polled by dashboard every 5–10s)
export const notificationRoutes: IRouter = Router();
notificationRoutes.param("id", validateObjectId);
notificationRoutes.get("/", authenticate, requirePermission("orders.read"), getAdminNotifications);
notificationRoutes.patch("/:id/read", authenticate, requirePermission("orders.read"), markNotificationRead);
notificationRoutes.post("/read-all", authenticate, requirePermission("orders.read"), markAllNotificationsRead);
