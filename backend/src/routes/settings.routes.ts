import { Router, IRouter } from "express";
import { getSettings, updateSettings, getWebhook, putWebhook, postWebhookTest } from "../controllers/settings.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
export const settingsRoutes: IRouter = Router();
settingsRoutes.get("/",getSettings);
settingsRoutes.put("/",authenticate,requireAdmin,updateSettings);
settingsRoutes.get("/admin/webhook",authenticate,requireAdmin,getWebhook);
settingsRoutes.put("/admin/webhook",authenticate,requireAdmin,putWebhook);
settingsRoutes.post("/admin/webhook/test",authenticate,requireAdmin,postWebhookTest);
