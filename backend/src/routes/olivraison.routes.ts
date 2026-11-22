import { Router, IRouter } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";
import {
  getOlivraisonConfig,
  putOlivraisonConfig,
  deleteOlivraisonConfig,
  testOlivraisonConnection,
  listOlivraisonShipments,
  retryOlivraisonShipment,
} from "../controllers/olivraison.controller";
export const olivraisonRoutes: IRouter = Router();
olivraisonRoutes.use(authenticate, requirePermission("settings.manage"));
olivraisonRoutes.get("/", getOlivraisonConfig);
olivraisonRoutes.put("/", putOlivraisonConfig);
olivraisonRoutes.delete("/", deleteOlivraisonConfig);
olivraisonRoutes.post("/test", testOlivraisonConnection);
olivraisonRoutes.get("/shipments", listOlivraisonShipments);
olivraisonRoutes.post("/shipments/:id/retry", retryOlivraisonShipment);
