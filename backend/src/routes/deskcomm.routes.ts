import { Router, IRouter } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";
import {
    getDeskcommConfig,
    putDeskcommConnection,
    putDeskcommConfig,
    getDeskcommOrderStatus,
} from "../controllers/deskcomm.controller";
export const deskcommRoutes: IRouter = Router();
deskcommRoutes.use(authenticate, requirePermission("crm.manage"));
deskcommRoutes.get("/", getDeskcommConfig);
deskcommRoutes.get("/orders/:reference", getDeskcommOrderStatus);
deskcommRoutes.put("/", putDeskcommConfig);

deskcommRoutes.put("/connection", putDeskcommConnection);
