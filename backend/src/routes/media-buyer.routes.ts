import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  authenticate,
  requireAdmin,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.middleware";
import {
  mediaConnection,
  connectMeta,
  disconnectMeta,
  setMediaTarget,
  syncMetaSpend,
} from "../lib/media-buyer-connection";
import { mediaReport } from "../lib/media-buyer-report";
export const mediaBuyerRoutes = Router();
mediaBuyerRoutes.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
mediaBuyerRoutes.use(authenticate, requirePermission("media.read"));
mediaBuyerRoutes.get("/connection", async (req, res) => {
  res.json({ success: true, data: await mediaConnection((req as AuthRequest).user!) });
});
mediaBuyerRoutes.get("/report", async (req, res) => {
  res.json({ success: true, data: await mediaReport(req.query) });
});
mediaBuyerRoutes.use(requireAdmin);
mediaBuyerRoutes.use(
  rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false }),
);
mediaBuyerRoutes.post("/connection", async (req, res) => {
  res.json({ success: true, data: await connectMeta((req as AuthRequest).user!, req.body) });
});
mediaBuyerRoutes.post("/disconnect", async (req, res) => {
  res.json({ success: true, data: await disconnectMeta((req as AuthRequest).user!, req.body) });
});
mediaBuyerRoutes.put("/target", async (req, res) => {
  res.json({ success: true, data: await setMediaTarget((req as AuthRequest).user!, req.body) });
});
mediaBuyerRoutes.post("/sync", async (req, res) => {
  res.json({ success: true, data: await syncMetaSpend((req as AuthRequest).user!, req.body) });
});
