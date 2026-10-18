import { Router, IRouter } from "express";
import {
    register,
    login,
    refreshToken,
    logout,
    getMe,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

export const authRoutes: IRouter = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/refresh", refreshToken);
authRoutes.post("/logout", logout);
authRoutes.get("/me", authenticate, getMe);
