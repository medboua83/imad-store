import { Router, IRouter } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requirePermission, type AuthRequest } from "../middleware/auth.middleware";
import {
  posContext,
  posCatalog,
  posScan,
  posQuote,
  posComplete,
  posHistory,
  posReceipt,
  posRecover,
} from "../controllers/pos.controller";
export const posRoutes: IRouter = Router();
posRoutes.use(authenticate, requirePermission("pos.sell", "pos.read"));
posRoutes.use(
  rateLimit({
    windowMs: 60000,
    limit: 240,
    keyGenerator: (req) => (req as AuthRequest).user!.id,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
posRoutes.get("/context", posContext);
posRoutes.get("/catalog", posCatalog);
posRoutes.get("/scan", requirePermission("pos.sell"), posScan);
posRoutes.post("/quote", requirePermission("pos.sell"), posQuote);
posRoutes.get("/sales", posHistory);
posRoutes.get("/sales/by-key/:key", posRecover);
posRoutes.get("/sales/:id", posReceipt);
posRoutes.post(
  "/sales",
  requirePermission("pos.sell"),
  rateLimit({
    windowMs: 60000,
    limit: 30,
    keyGenerator: (req) => (req as AuthRequest).user!.id,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  posComplete,
);
