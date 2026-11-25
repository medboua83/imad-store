import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";
import { assertBrowserRequest, clearAdminCookies, readAdminCookie, setAdminCookies } from "./admin-cookies";

type Account = { id: string; email: string; role: string; authVersion: number; permissions: string[] };
export function browserIdentity(user: Account) {
    return { id: user.id, role: user.role, authVersion: user.authVersion, permissions: user.role === "STAFF" ? user.permissions : [] };
}
function staff(user: Account) {
    if (!["ADMIN", "STAFF"].includes(user.role)) throw new AppError("Staff access required", 403);
}
function accessToken(user: Account, sid: string) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role, sv: user.authVersion, sid }, process.env.JWT_SECRET!,
        { algorithm: "HS256", expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m") as jwt.SignOptions["expiresIn"] });
}
function newSession(user: Account) {
    staff(user);
    const id = randomBytes(12).toString("hex");
    const token = jwt.sign({ id: user.id, sv: user.authVersion, sid: id }, process.env.JWT_REFRESH_SECRET!,
        { algorithm: "HS256", jwtid: randomUUID(), expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"] });
    const expiresAt = new Date((jwt.decode(token) as jwt.JwtPayload).exp! * 1000);
    return { id, token, userId: user.id, expiresAt };
}
function respond(res: Response, user: Account, session: { id: string; token: string; expiresAt: Date }) {
    setAdminCookies(res, accessToken(user, session.id), session.token, session.expiresAt);
    return res.json({ success: true, data: { mode: "cookie", identity: browserIdentity(user) } });
}
export async function startBrowserSession(req: Request, res: Response, user: Account) {
    assertBrowserRequest(req);
    const session = newSession(user);
    await prisma.refreshToken.create({ data: session });
    return respond(res, user, session);
}
async function readRefresh(token: string | null, cookie: boolean) {
    if (!token || token.length > 4096) throw new AppError("Session expirée. Reconnectez-vous.", 401);
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!, { algorithms: ["HS256"] }) as jwt.JwtPayload; }
    catch { throw new AppError("Session expirée. Reconnectez-vous.", 401); }
    const stored = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } });
    if (!stored || payload.id !== stored.userId || stored.expiresAt <= new Date() || !stored.user.isActive
        || stored.user.mustSetPassword || (payload.sv ?? 0) !== stored.user.authVersion
        || cookie && payload.sid !== stored.id || !cookie && payload.sid !== undefined)
        throw new AppError("Session expirée. Reconnectez-vous.", 401);
    staff(stored.user);
    return stored;
}
export async function refreshBrowserSession(req: Request, res: Response) {
    assertBrowserRequest(req);
    try {
        const stored = await readRefresh(readAdminCookie(req, "refresh"), true);
        // A browser session has one absolute expiry and one revocable database row.
        // The HttpOnly refresh credential stays stable so concurrent tabs cannot
        // invalidate each other's refresh; access credentials remain short-lived.
        return respond(res, stored.user, stored);
    } catch (error) {
        if (error instanceof AppError && [401,403].includes(error.status)) clearAdminCookies(res);
        throw error;
    }
}
export async function migrateBrowserSession(req: Request, res: Response) {
    assertBrowserRequest(req);
    const { token } = z.object({ token: z.string().min(1).max(4096) }).parse(req.body);
    const stored = await readRefresh(token, false), session = newSession(stored.user);
    await prisma.$transaction(async tx => {
        const removed = await tx.refreshToken.deleteMany({ where: { id: stored.id, token } });
        if (removed.count !== 1) throw new AppError("Session expirée. Reconnectez-vous.", 401);
        await tx.refreshToken.create({ data: session });
    });
    return respond(res, stored.user, session);
}
export async function endBrowserSession(req: Request, res: Response) {
    assertBrowserRequest(req);
    const token = readAdminCookie(req, "refresh"), access = readAdminCookie(req, "access");
    let session: { id: string; userId: string } | undefined;
    try {
        const payload = jwt.verify(access ?? "", process.env.JWT_SECRET!, { algorithms: ["HS256"], ignoreExpiration: true }) as jwt.JwtPayload;
        if (typeof payload.sid === "string" && /^[a-f0-9]{24}$/.test(payload.sid) && typeof payload.id === "string")
            session = { id: payload.sid, userId: payload.id };
    } catch { /* Clearing an already-expired or missing session is still safe. */ }
    if (token || session) await prisma.refreshToken.deleteMany({ where: { OR: [...(token ? [{ token }] : []), ...(session ? [session] : [])] } });
    clearAdminCookies(res);
    return res.json({ success: true });
}
