import { Router, IRouter } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import {
  getOlivraisonConfig,
  putOlivraisonConfig,
  testOlivraisonConnection,
  listOlivraisonShipments,
  retryOlivraisonShipment,
} from "../controllers/olivraison.controller";
export const olivraisonRoutes: IRouter = Router();
olivraisonRoutes.use(authenticate, requireAdmin);
olivraisonRoutes.get("/", getOlivraisonConfig);
olivraisonRoutes.put("/", putOlivraisonConfig);
olivraisonRoutes.post("/test", testOlivraisonConnection);
olivraisonRoutes.get("/shipments", listOlivraisonShipments);
olivraisonRoutes.post("/shipments/:id/retry", retryOlivraisonShipment);
