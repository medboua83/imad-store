import { storeOrderPeriod } from "../lib/analytics-period";
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
    closeOrderCarrierIncident,
    getCarrierIncidentHistory,
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
orderRoutes.get("/calendar", authenticate, requirePermission("orders.read"), (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const days = req.query.days ?? "1";
    if (typeof days !== "string" || !["1", "7", "30", "90"].includes(days)) {
        res.status(400).json({ success: false, error: "Unsupported order period" });
        return;
    }
    res.json({ success: true, data: storeOrderPeriod(Number(days)) });
});
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
orderRoutes.post("/:id/carrier-incident-close", authenticate, requirePermission("orders.read"), requirePermission("orders.write"), closeOrderCarrierIncident);
orderRoutes.get("/:id/carrier-incident-history", authenticate, requirePermission("orders.read"), getCarrierIncidentHistory);

// Admin notifications (polled by dashboard every 5–10s)
export const notificationRoutes: IRouter = Router();
notificationRoutes.param("id", validateObjectId);
notificationRoutes.get("/", authenticate, requirePermission("orders.read"), getAdminNotifications);
notificationRoutes.patch("/:id/read", authenticate, requirePermission("orders.read"), markNotificationRead);
notificationRoutes.post("/read-all", authenticate, requirePermission("orders.read"), markAllNotificationsRead);
