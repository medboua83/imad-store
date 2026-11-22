import { Router, IRouter } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const settingsRoutes: IRouter = Router();

// Public — frontend reads shipping cost etc.
settingsRoutes.get("/", getSettings);

// Admin only
settingsRoutes.put("/", authenticate, requirePermission("settings.manage"), updateSettings);
