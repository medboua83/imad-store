import { Router, IRouter } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

import { brandingRoutes } from "./branding.routes";
import { readStoreReadiness } from "../lib/store-readiness";
import { z } from "zod";
const readinessRoutes = Router();
readinessRoutes.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
readinessRoutes.use(authenticate, requirePermission("settings.manage"));
readinessRoutes.get("/", async (req, res) => {
    z.object({}).strict().parse(req.query);
    const user = (req as import("../middleware/auth.middleware").AuthRequest).user!;
    res.json({ success: true, data: await readStoreReadiness(user.id, user.role === "ADMIN") });
});
export const settingsRoutes: IRouter = Router();
settingsRoutes.use("/branding", brandingRoutes);
settingsRoutes.use("/readiness", readinessRoutes);

// Public — frontend reads shipping cost etc.
settingsRoutes.get("/", getSettings);

// Admin only
settingsRoutes.put("/", authenticate, requirePermission("settings.manage"), updateSettings);
