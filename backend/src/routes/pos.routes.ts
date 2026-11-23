import * as returns from "../controllers/pos-returns.controller";
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
import {
  posCashState,
  posCashOpen,
  posCashClose,
  posCashRecover,
  posCashRead,
  posCashList,
} from "../controllers/pos-cash.controller";
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

posRoutes.get("/cash-sessions/context", posCashState);
posRoutes.get("/cash-sessions/attempt/:key", requirePermission("pos.sell"), posCashRecover);
posRoutes.get("/cash-sessions", posCashList);
posRoutes.get("/cash-sessions/:id", posCashRead);
const cashWrites = rateLimit({
  windowMs: 60000,
  limit: 30,
  keyGenerator: (req) => (req as AuthRequest).user!.id,
  standardHeaders: true,
  legacyHeaders: false,
});
posRoutes.post("/cash-sessions/open", requirePermission("pos.sell"), cashWrites, posCashOpen);
posRoutes.post("/cash-sessions/close", requirePermission("pos.sell"), cashWrites, posCashClose);

const returnWrites = [requirePermission("pos.sell"), requirePermission("pos.returns")];
posRoutes.get("/returns/source", ...returnWrites, returns.source);
posRoutes.post("/returns/quote", ...returnWrites, returns.quote);
posRoutes.get("/returns/by-key/:key", ...returnWrites, returns.recover);
posRoutes.get("/returns", returns.history);
posRoutes.get("/returns/:id", returns.read);
posRoutes.post("/returns", ...returnWrites, cashWrites, returns.complete);
