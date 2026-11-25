import type { Response } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { assertBrowserRequest, clearAdminCookies } from "../lib/admin-cookies";
import { lockTeam } from "../lib/team-access";
import { MFA_SETUP_MS, currentMfaAccount, generateMfaSecret, generateRecoveryCodes, recoveryHash, sealMfaSecret,
    openMfaSecret, mfaTotp, matchMfaStep, consumeMfa, rejectMfa, factorResult, isMfaLocked, lockedFactor } from "../lib/admin-mfa";

const password = z.string().min(1).max(128);
const code = z.string().trim().min(1).max(80);
const staff = (req: AuthRequest) => {
    if (!req.user || !["ADMIN", "STAFF"].includes(req.user.role)) throw new AppError("Staff access required", 403);
    return req.user;
};
export async function readMfa(req: AuthRequest, res: Response) {
    const actor = staff(req), state = await prisma.adminMfa.findUnique({ where: { userId: actor.id } });
    res.json({ success: true, data: { enabled: !!state?.enabledAt, enabledAt: state?.enabledAt ?? null,
        recoveryCodesRemaining: state?.enabledAt ? state.recoveryHashes.length : 0 } });
}
export async function setupMfa(req: AuthRequest, res: Response) {
    const actor = staff(req), body = z.object({ currentPassword: password }).strict().parse(req.body);
    const secret = generateMfaSecret(), codes = generateRecoveryCodes(), setupId = randomBytes(16).toString("hex");
    let issuer = "Boutique";
    try { issuer = new URL(process.env.SITE_URL || "").hostname; } catch { /* Portable local fixture. */ }
    const qr = await QRCode.toDataURL(mfaTotp(secret, actor.email, issuer).toString(), { errorCorrectionLevel: "M", margin: 4, width: 280 });
    const expiresAt = new Date(Date.now() + MFA_SETUP_MS);
    await prisma.$transaction(async tx => {
        await lockTeam(tx); await currentMfaAccount(tx, actor, body.currentPassword);
        const previous = await tx.adminMfa.findUnique({ where: { userId: actor.id } });
        if (previous?.enabledAt) throw new AppError("La double authentification est déjà active.", 409);
        if (previous && isMfaLocked(previous)) throw lockedFactor();
        const pending = { pendingCiphertext: sealMfaSecret(actor.id, secret), pendingRecoveryHashes: codes.map(c => recoveryHash(actor.id, c)), pendingExpiresAt: expiresAt, setupId };
        await tx.adminMfa.upsert({ where: { userId: actor.id }, create: { userId: actor.id, ...pending }, update: pending });
    }, { isolationLevel: "ReadCommitted" });
    res.json({ success: true, data: { setupId, secret, qr, recoveryCodes: codes, expiresAt } });
}
export async function confirmMfa(req: AuthRequest, res: Response) {
    const actor = staff(req), body = z.object({ currentPassword: password, setupId: z.string().regex(/^[a-f0-9]{32}$/), code, recoverySaved: z.literal(true) }).strict().parse(req.body);
    const result = await prisma.$transaction(async tx => {
        await lockTeam(tx); await currentMfaAccount(tx, actor, body.currentPassword);
        const state = await tx.adminMfa.findUnique({ where: { userId: actor.id } });
        if (!state || state.enabledAt || state.setupId !== body.setupId || !state.pendingCiphertext || !state.pendingExpiresAt || state.pendingExpiresAt.getTime() <= Date.now())
            throw new AppError("Préparation expirée ou remplacée. Recommencez la configuration.", 409);
        if (isMfaLocked(state)) return "locked" as const;
        const step = matchMfaStep(openMfaSecret(actor.id, state.pendingCiphertext), body.code, null);
        if (step === null) return rejectMfa(tx, state);
        await tx.adminMfa.update({ where: { userId: actor.id }, data: { secretCiphertext: state.pendingCiphertext, enabledAt: new Date(), recoveryHashes: state.pendingRecoveryHashes,
            pendingCiphertext: null, pendingExpiresAt: null, pendingRecoveryHashes: [], setupId: null, lastUsedStep: step, failedAttempts: 0, lockedUntil: null } });
        await tx.user.update({ where: { id: actor.id }, data: { authVersion: { increment: 1 } } });
        await tx.refreshToken.deleteMany({ where: { userId: actor.id } });
        await tx.accessEvent.create({ data: { actorId: actor.id, action: "MFA_ENABLED" } });
        return "ok" as const;
    }, { isolationLevel: "ReadCommitted" });
    factorResult(result); clearAdminCookies(res); res.json({ success: true });
}
export async function cancelMfaSetup(req: AuthRequest, res: Response) {
    const actor = staff(req), { setupId } = z.object({ setupId: z.string().regex(/^[a-f0-9]{32}$/) }).strict().parse(req.body);
    await prisma.$transaction(async tx => {
        await lockTeam(tx);
        const fresh = await tx.user.findUnique({ where: { id: actor.id } });
        if (!fresh?.isActive || fresh.authVersion !== actor.authVersion) throw new AppError("Session expirée.", 401);
        await tx.adminMfa.updateMany({ where: { userId: actor.id, setupId, enabledAt: null }, data: { pendingCiphertext: null, pendingRecoveryHashes: [], pendingExpiresAt: null, setupId: null } });
    });
    res.json({ success: true });
}
export async function disableMfa(req: AuthRequest, res: Response) {
    const actor = staff(req), body = z.object({ currentPassword: password, code }).strict().parse(req.body);
    const result = await prisma.$transaction(async tx => {
        await lockTeam(tx); await currentMfaAccount(tx, actor, body.currentPassword);
        const state = await tx.adminMfa.findUnique({ where: { userId: actor.id } });
        if (!state?.enabledAt) throw new AppError("La double authentification n’est pas active.", 409);
        const valid = await consumeMfa(tx, state, body.code, { allowLastRecovery: true });
        if (valid !== "ok") return valid;
        await tx.adminMfa.update({ where: { userId: actor.id }, data: { secretCiphertext: null, enabledAt: null, recoveryHashes: [], lastUsedStep: null,
            pendingCiphertext: null, pendingRecoveryHashes: [], pendingExpiresAt: null, setupId: null, failedAttempts: 0, lockedUntil: null } });
        await tx.user.update({ where: { id: actor.id }, data: { authVersion: { increment: 1 } } });
        await tx.refreshToken.deleteMany({ where: { userId: actor.id } });
        await tx.accessEvent.create({ data: { actorId: actor.id, action: "MFA_DISABLED" } });
        return "ok" as const;
    }, { isolationLevel: "ReadCommitted" });
    factorResult(result); clearAdminCookies(res); res.json({ success: true });
}

// A password plus one unused recovery code suffices even without an open session.
// The last code is reserved for this explicit reset instead of stranding its owner.
export async function recoverMfa(req: Request, res: Response) {
    assertBrowserRequest(req);
    const body = z.object({ email: z.string().trim().email().max(254), password, code }).strict().parse(req.body);
    const candidate = await prisma.user.findFirst({ where: { email: { equals: body.email, mode: "insensitive" } } });
    if (!candidate?.isActive || candidate.mustSetPassword || !["ADMIN", "STAFF"].includes(candidate.role) || !await bcrypt.compare(body.password, candidate.passwordHash))
        throw new AppError("Invalid credentials", 401);
    const result = await prisma.$transaction(async tx => {
        await lockTeam(tx);
        const user = await tx.user.findUnique({ where: { id: candidate.id } });
        if (!user?.isActive || user.mustSetPassword || !["ADMIN", "STAFF"].includes(user.role) || user.passwordHash !== candidate.passwordHash)
            throw new AppError("Invalid credentials", 401);
        const state = await tx.adminMfa.findUnique({ where: { userId: user.id } });
        if (!state?.enabledAt) return "ok" as const; // Safe retry after an ambiguous successful response.
        const valid = await consumeMfa(tx, state, body.code, { recoveryOnly: true, allowLastRecovery: true });
        if (valid !== "ok") return valid;
        await tx.adminMfa.update({ where: { userId: user.id }, data: { secretCiphertext: null, enabledAt: null, recoveryHashes: [], lastUsedStep: null,
            pendingCiphertext: null, pendingRecoveryHashes: [], pendingExpiresAt: null, setupId: null, failedAttempts: 0, lockedUntil: null } });
        await tx.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
        await tx.refreshToken.deleteMany({ where: { userId: user.id } });
        await tx.accessEvent.create({ data: { actorId: user.id, action: "MFA_RECOVERED" } });
        return "ok" as const;
    }, { isolationLevel: "ReadCommitted" });
    factorResult(result); clearAdminCookies(res); res.json({ success: true });
}
