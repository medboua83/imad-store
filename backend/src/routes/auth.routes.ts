import { Router, IRouter } from "express";
import {
    register,
    login,
    refreshToken,
    logout,
    getMe,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import rateLimit from "express-rate-limit";
import { forgotPassword, resetPassword, changePassword } from "../controllers/password.controller";

export const authRoutes: IRouter = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/refresh", refreshToken);
authRoutes.post("/logout", logout);
authRoutes.get("/me", authenticate, getMe);
const recoveryLimit = () => rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
authRoutes.post("/forgot-password", recoveryLimit(), forgotPassword);
authRoutes.post("/reset-password", recoveryLimit(), resetPassword);
authRoutes.post("/change-password", authenticate, recoveryLimit(), changePassword);
