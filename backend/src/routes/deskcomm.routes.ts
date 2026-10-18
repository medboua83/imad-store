import { Router, IRouter } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import { getDeskcommConfig, putDeskcommConfig } from "../controllers/deskcomm.controller";
export const deskcommRoutes: IRouter=Router();
deskcommRoutes.use(authenticate,requireAdmin);
deskcommRoutes.get("/",getDeskcommConfig);
deskcommRoutes.put("/",putDeskcommConfig);
