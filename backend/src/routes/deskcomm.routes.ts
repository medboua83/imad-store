import { Router, IRouter } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import {
    getDeskcommConfig,
    putDeskcommConfig,
    getDeskcommOrderStatus,
} from "../controllers/deskcomm.controller";
export const deskcommRoutes: IRouter = Router();
deskcommRoutes.use(authenticate, requireAdmin);
deskcommRoutes.get("/", getDeskcommConfig);
deskcommRoutes.get("/orders/:reference", getDeskcommOrderStatus);
deskcommRoutes.put("/", putDeskcommConfig);
