import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { canAdmin, type AdminPermission } from "@imad-store/shared";

import { readAdminCookie, hasAdminCookie, assertBrowserRequest } from "../lib/admin-cookies";

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        authVersion: number;
    };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    const cookie = !authHeader && hasAdminCookie(req);
    if (cookie) { try { assertBrowserRequest(req); } catch (error) { next(error); return; } }
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookie ? readAdminCookie(req, "access") : null;
    if (!token) {
        res.status(401).json({ success: false, error: "No token provided" });
        return;
    }

    res.setHeader("Cache-Control", "private, no-store");
    let payload: {
            id: string;
            email: string;
            role: string;
            sv?: number;
            sid?: string;
        };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as typeof payload;
        if (cookie && !payload.sid) throw new Error("Browser session required");
        if (typeof payload.id !== "string" || !/^[a-f0-9]{24}$/.test(payload.id)) throw new Error("Invalid identity");
    } catch {
        res.status(401).json({ success: false, error: "Invalid or expired token" }); return;
    }
    try {
        const user = await prisma.user.findUnique({ where: { id: payload.id } });
        // A token can never elevate the role stored on the account.
        if (!user || !user.isActive || user.mustSetPassword || (payload.sv ?? 0) !== user.authVersion
            || payload.role !== user.role && payload.role !== "CUSTOMER") {
            res.status(401).json({ success: false, error: "Invalid or expired token" }); return;
        }
        if (payload.sid) {
            if (!/^[a-f0-9]{24}$/.test(payload.sid)) { res.status(401).json({ success: false, error: "Invalid session" }); return; }
            const session = await prisma.refreshToken.findUnique({ where: { id: payload.sid }, select: { userId: true, expiresAt: true } });
            if (!session || session.userId !== user.id || session.expiresAt <= new Date()) { res.status(401).json({ success: false, error: "Expired session" }); return; }
        }
        if (cookie && req.originalUrl.split("?")[0] !== "/api/auth/session"
            && req.get("X-Imad-Admin-Identity") !== user.id + ":" + user.authVersion) {
            res.status(409).json({ success: false, code: "SESSION_CHANGED", error: "Le compte connecté a changé. Rechargez votre session avant de continuer." }); return;
        }
        req.user = { id: user.id, email: user.email, role: payload.role, permissions: user.permissions, authVersion: user.authVersion };
        next();
    } catch (error) { next(error); }
}

export function requirePermission(...permissions: AdminPermission[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !permissions.some(permission => canAdmin(req.user!, permission))) {
            res.status(403).json({ success: false, code: "PERMISSION_DENIED", error: "Accès non autorisé pour ce compte." });
            return;
        }
        next();
    };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
    if (req.user?.role !== "ADMIN") {
        res.status(403).json({ success: false, code: "PERMISSION_DENIED", error: "Admin access required" });
        return;
    }
    next();
}
