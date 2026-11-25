import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import type { AdminMfa, Prisma, User } from "@prisma/client";
import { prisma } from "./prisma";
import { encryptDeskcommValue, decryptDeskcommValue } from "./deskcomm-config";
import { lockTeam } from "./team-access";
import { AppError } from "../middleware/error.middleware";

export const MFA_LOCK_MS = 15 * 60 * 1000;
export const MFA_SETUP_MS = 10 * 60 * 1000;
export const invalidFactor = () => new AppError("Code incorrect, expiré ou déjà utilisé. Attendez le prochain code ou utilisez un code de secours.", 400);
export const lockedFactor = () => new AppError("Trop d’essais. Réessayez dans 15 minutes.", 429);
export function mfaTotp(secret: string, email = "", issuer = "Boutique") {
    return new TOTP({ issuer, label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
}
export function generateMfaSecret() { return new Secret({ size: 20 }).base32; }
export function sealMfaSecret(userId: string, secret: string) {
    return encryptDeskcommValue(JSON.stringify({ purpose: "admin-mfa-v1", userId, secret }));
}
export function openMfaSecret(userId: string, ciphertext: string) {
    const value = JSON.parse(decryptDeskcommValue(ciphertext));
    if (value.purpose !== "admin-mfa-v1" || value.userId !== userId || !/^[A-Z2-7]{32}$/.test(value.secret))
        throw new Error("Invalid MFA secret context");
    return value.secret as string;
}
export function recoveryHash(userId: string, code: string) {
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    return createHash("sha256").update("imad-mfa-recovery\0" + userId + "\0" + normalized).digest("hex");
}
export function generateRecoveryCodes() {
    return Array.from({ length: 10 }, () => randomBytes(12).toString("hex").toUpperCase().match(/.{4}/g)!.join("-"));
}
export function matchMfaStep(secret: string, code: string, last: bigint | null, now = Date.now()): bigint | null {
    if (!/^\d{6}$/.test(code)) return null;
    const totp = mfaTotp(secret), delta = totp.validate({ token: code, timestamp: now, window: 1 });
    if (delta === null) return null;
    const step = BigInt(Math.floor(now / 30000) + delta);
    return last === null || step > last ? step : null;
}
export function isMfaLocked(state: AdminMfa, now = Date.now()) { return !!state.lockedUntil && state.lockedUntil.getTime() > now; }
export async function rejectMfa(tx: Prisma.TransactionClient, state: AdminMfa) {
    const attempts = (state.lockedUntil && state.lockedUntil.getTime() <= Date.now() ? 0 : state.failedAttempts) + 1;
    await tx.adminMfa.update({ where: { userId: state.userId }, data: { failedAttempts: attempts >= 5 ? 0 : attempts,
        lockedUntil: attempts >= 5 ? new Date(Date.now() + MFA_LOCK_MS) : null } });
    return attempts >= 5 ? "locked" as const : "invalid" as const;
}
export async function consumeMfa(tx: Prisma.TransactionClient, state: AdminMfa, code: string, options: { recoveryOnly?: boolean; allowLastRecovery?: boolean } = {}) {
    if (isMfaLocked(state)) return "locked" as const;
    const step = options.recoveryOnly || !/^\d{6}$/.test(code) ? null : matchMfaStep(openMfaSecret(state.userId, state.secretCiphertext!), code, state.lastUsedStep);
    if (step !== null) {
        await tx.adminMfa.update({ where: { userId: state.userId }, data: { lastUsedStep: step, failedAttempts: 0, lockedUntil: null } });
        return "ok" as const;
    }
    const digest = recoveryHash(state.userId, code);
    const found = state.recoveryHashes.find(hash => hash.length === digest.length && timingSafeEqual(Buffer.from(hash), Buffer.from(digest)));
    if (found) {
        if (state.recoveryHashes.length === 1 && !options.allowLastRecovery) return "last-recovery" as const;
        await tx.adminMfa.update({ where: { userId: state.userId }, data: { recoveryHashes: state.recoveryHashes.filter(hash => hash !== found), failedAttempts: 0, lockedUntil: null } });
        await tx.accessEvent.create({ data: { actorId: state.userId, action: "MFA_RECOVERY_USED" } });
        return "ok" as const;
    }
    return rejectMfa(tx, state);
}
export function factorResult(result: "ok" | "locked" | "invalid" | "last-recovery") {
    if (result === "locked") throw lockedFactor();
    if (result === "invalid") throw invalidFactor();
    if (result === "last-recovery") throw new AppError("Ce dernier code est réservé à la récupération. Choisissez « J’ai perdu mon téléphone » pour réinitialiser votre protection avec ce code.", 409);
}
// Shares the account-change lock with password resets and team permission edits.
// Failed counters commit before the public error is thrown.
export async function verifyLoginMfa(user: User, code?: string) {
    const result = await prisma.$transaction(async tx => {
        await lockTeam(tx);
        const fresh = await tx.user.findUnique({ where: { id: user.id } });
        if (!fresh?.isActive || fresh.mustSetPassword || fresh.authVersion !== user.authVersion || fresh.passwordHash !== user.passwordHash)
            throw new AppError("Invalid credentials", 401);
        const state = await tx.adminMfa.findUnique({ where: { userId: user.id } });
        if (!state?.enabledAt) return "ok" as const;
        if (!code) return "required" as const;
        return consumeMfa(tx, state, code);
    }, { isolationLevel: "ReadCommitted" });
    if (result === "required") return false;
    factorResult(result); return true;
}
export async function currentMfaAccount(tx: Prisma.TransactionClient, actor: { id: string; authVersion: number }, password: string) {
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    if (!user?.isActive || user.mustSetPassword || !["ADMIN", "STAFF"].includes(user.role) || user.authVersion !== actor.authVersion)
        throw new AppError("Votre session a changé. Reconnectez-vous.", 401);
    if (!await bcrypt.compare(password, user.passwordHash)) throw new AppError("Votre mot de passe actuel est incorrect.", 400);
    return user;
}
