import { Router, IRouter } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

import { brandingRoutes } from "./branding.routes";
export const settingsRoutes: IRouter = Router();
settingsRoutes.use("/branding", brandingRoutes);

// Public — frontend reads shipping cost etc.
settingsRoutes.get("/", getSettings);

// Admin only
settingsRoutes.put("/", authenticate, requirePermission("settings.manage"), updateSettings);
