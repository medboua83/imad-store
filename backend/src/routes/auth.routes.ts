import { Router, IRouter } from "express";
import {
    register,
    login,
    refreshToken,
    logout,
    getMe,
    getBrowserSession,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import rateLimit from "express-rate-limit";
import { forgotPassword, resetPassword, changePassword } from "../controllers/password.controller";

import { assertBrowserRequest } from "../lib/admin-cookies";
import { migrateBrowserSession } from "../lib/admin-browser-session";

export const authRoutes: IRouter = Router();
authRoutes.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
authRoutes.get("/session", (req, res, next) => { assertBrowserRequest(req); if (req.headers.authorization) return res.status(401).json({ success: false }); next(); }, authenticate, getBrowserSession);
authRoutes.post("/session/migrate", migrateBrowserSession);

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/refresh", refreshToken);
authRoutes.post("/logout", logout);
authRoutes.get("/me", authenticate, getMe);
const recoveryLimit = () => rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
authRoutes.post("/forgot-password", recoveryLimit(), forgotPassword);
authRoutes.post("/reset-password", recoveryLimit(), resetPassword);
authRoutes.post("/change-password", authenticate, recoveryLimit(), changePassword);
