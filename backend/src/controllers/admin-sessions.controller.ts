import type { Response } from "express";
import type { Prisma, RefreshToken } from "@prisma/client";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { prisma } from "../lib/prisma";
import { lockTeam } from "../lib/team-access";
import { consumeMfa, currentMfaAccount, factorResult } from "../lib/admin-mfa";
import { readAdminCookie } from "../lib/admin-cookies";

const expired = () => new AppError("Votre session a changé. Reconnectez-vous.", 401);
function actor(req: AuthRequest) {
    if (!req.user || !["ADMIN", "STAFF"].includes(req.user.role) || !req.adminBrowserSessionId)
        throw new AppError("Reconnectez-vous au dashboard pour consulter vos sessions.", 403);
    const credential = readAdminCookie(req, "refresh");
    if (!credential) throw expired();
    return { ...req.user, sessionId: req.adminBrowserSessionId, credential };
}
type Actor = ReturnType<typeof actor>;
// Old API refresh credentials share the table. Never expose them or treat them as
// cookie sessions: they do not have the immediate, session-bound revocation model.
function browserRow(row: RefreshToken, user: Actor, now: Date) {
    if (row.userId !== user.id || row.expiresAt <= now) return false;
    try {
        const payload = jwt.verify(row.token, process.env.JWT_REFRESH_SECRET!, {
            algorithms: ["HS256"], clockTimestamp: Math.floor(now.getTime() / 1000),
        }) as jwt.JwtPayload;
        return payload.id === user.id && payload.sid === row.id && (payload.sv ?? 0) === user.authVersion;
    } catch { return false; }
}
const metadata = (row: RefreshToken) => ({ id: row.id, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() });
async function currentSession(tx: Prisma.TransactionClient, user: Actor, now: Date) {
    const [account, current] = await Promise.all([
        tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, mustSetPassword: true, role: true, authVersion: true } }),
        tx.refreshToken.findUnique({ where: { id: user.sessionId } }),
    ]);
    if (!account?.isActive || account.mustSetPassword || account.role !== user.role || account.authVersion !== user.authVersion
        || !current || current.token !== user.credential || !browserRow(current, user, now)) throw expired();
    return current;
}
function older(row: Pick<RefreshToken, "createdAt" | "id">) {
    return { OR: [{ createdAt: { lt: row.createdAt } }, { createdAt: row.createdAt, id: { lt: row.id } }] };
}

export async function listOwnBrowserSessions(req: AuthRequest, res: Response) {
    const user = actor(req);
    const { before } = z.object({ before: z.string().regex(/^[a-f0-9]{24}$/).optional() }).strict().parse(req.query);
    const data = await prisma.$transaction(async tx => {
        const now = new Date(), current = await currentSession(tx, user, now);
        const mfa = await tx.adminMfa.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
        let cursor = before ? await tx.refreshToken.findFirst({ where: { id: before, userId: user.id } }) : null;
        if (before && !cursor) throw new AppError("La liste des sessions a changé. Actualisez-la.", 409);
        const items: ReturnType<typeof metadata>[] = [];
        // Bound each page's work even if many old or malformed API rows exist.
        for (let batch = 0; batch < 5; batch++) {
            const rows = await tx.refreshToken.findMany({ where: { userId: user.id, id: { not: user.sessionId },
                expiresAt: { gt: now }, createdAt: { lte: now }, ...(cursor ? older(cursor) : {}) },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101 });
            for (const row of rows.slice(0, 100)) {
                cursor = row;
                if (browserRow(row, user, now)) items.push(metadata(row));
                if (items.length === 21) return { current: metadata(current), others: items.slice(0, 20), nextCursor: items[19].id, mfaEnabled: !!mfa?.enabledAt };
            }
            if (rows.length <= 100) return { current: metadata(current), others: items, nextCursor: null, mfaEnabled: !!mfa?.enabledAt };
        }
        return { current: metadata(current), others: items, nextCursor: cursor!.id, mfaEnabled: !!mfa?.enabledAt };
    }, { isolationLevel: "RepeatableRead" });
    res.json({ success: true, data });
}

export async function closeOtherBrowserSessions(req: AuthRequest, res: Response) {
    const user = actor(req), body = z.object({ currentPassword: z.string().min(1).max(128),
        code: z.string().trim().min(1).max(80).optional() }).strict().parse(req.body);
    const result = await prisma.$transaction(async tx => {
        await lockTeam(tx);
        await currentMfaAccount(tx, user, body.currentPassword);
        const now = new Date();
        await currentSession(tx, user, now);
        const mfa = await tx.adminMfa.findUnique({ where: { userId: user.id } });
        if (mfa?.enabledAt) {
            if (!body.code) throw new AppError("Saisissez le code de l’application ou un code de secours.", 400);
            const factor = await consumeMfa(tx, mfa, body.code);
            if (factor !== "ok") return { factor, closed: 0 };
        }
        let cursor: Pick<RefreshToken, "id" | "createdAt"> | null = null, scanned = 0, closed = 0;
        for (;;) {
            const rows: RefreshToken[] = await tx.refreshToken.findMany({ where: { userId: user.id, id: { not: user.sessionId },
                expiresAt: { gt: now }, createdAt: { lte: now }, ...(cursor ? older(cursor) : {}) },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
            if (!rows.length) break;
            scanned += rows.length;
            if (scanned > 5000) throw new AppError("Trop de connexions à traiter. Changez votre mot de passe pour fermer toutes les connexions.", 409);
            cursor = rows[rows.length - 1];
            const ids = rows.filter(row => browserRow(row, user, now)).map(row => row.id);
            if (ids.length) closed += (await tx.refreshToken.deleteMany({ where: { userId: user.id, id: { in: ids, not: user.sessionId } } })).count;
            if (rows.length < 100) break;
        }
        if (closed) await tx.accessEvent.create({ data: { actorId: user.id, targetId: user.id, action: "OTHER_BROWSER_SESSIONS_CLOSED" } });
        return { factor: "ok" as const, closed };
    }, { isolationLevel: "ReadCommitted" });
    factorResult(result.factor);
    res.json({ success: true, data: { closed: result.closed, currentSessionKept: true } });
}
