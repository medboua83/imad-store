import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { queueAccessMail, resetHash } from "../lib/password-reset";
import { lockTeam, verifyCurrentPassword } from "../lib/team-access";
import { AuthRequest } from "../middleware/auth.middleware";
const password = z.string().min(12).max(128).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Ce mot de passe est trop long. Choisissez une version plus courte.");
const invalid = () => new AppError("Ce lien est expiré ou déjà utilisé. Demandez un nouveau lien.", 400);

export async function forgotPassword(req: Request, res: Response) {
    const started = Date.now();
    const { email } = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()) }).strict().parse(req.body);
    await prisma.$transaction(async tx => {
        await lockTeam(tx);
        const user = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, isActive: true, role: { in: ["ADMIN", "STAFF"] } } });
        const cfg = await tx.gmailConfig.findUnique({ where: { id: "gmail" } });
        if (!user || !cfg?.enabled || !cfg.passwordCiphertext) return;
        const previous = await tx.passwordReset.findUnique({ where: { userId: user.id } });
        if (previous && previous.requestedAt.getTime() > Date.now() - 60000) return;
        await queueAccessMail(tx, user);
    }, { isolationLevel: "ReadCommitted" });
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 350 - (Date.now() - started))));
    res.status(202).json({ success: true, message: "Si un compte actif correspond à cette adresse, un lien vous sera envoyé. Vérifiez aussi les courriers indésirables." });
}
export async function resetPassword(req: Request, res: Response) {
    const body = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password }).strict().parse(req.body);
    const tokenHash = resetHash(body.token);
    const candidate = await prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (!candidate || candidate.expiresAt.getTime() <= Date.now()) throw invalid();
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction(async tx => {
        await lockTeam(tx);
        const reset = await tx.passwordReset.findUnique({ where: { tokenHash } });
        if (!reset || reset.expiresAt.getTime() <= Date.now()) throw invalid();
        const updated = await tx.user.updateMany({ where: { id: reset.userId, authVersion: reset.authVersion, isActive: true,
            role: { in: ["ADMIN", "STAFF"] } }, data: { passwordHash, mustSetPassword: false, authVersion: { increment: 1 } } });
        if (updated.count !== 1) throw invalid();
        await tx.refreshToken.deleteMany({ where: { userId: reset.userId } });
        await tx.passwordReset.deleteMany({ where: { userId: reset.userId } });
        await tx.accessEvent.create({ data: { actorId: reset.userId, targetId: reset.userId, action: "PASSWORD_RESET" } });
    }, { isolationLevel: "ReadCommitted" });
    res.json({ success: true });
}
export async function changePassword(req: AuthRequest, res: Response) {
    const body = z.object({ currentPassword: z.string().min(1).max(128), password }).strict().parse(req.body);
    await verifyCurrentPassword(req.user!.id, body.currentPassword);
    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction(async tx => {
        await lockTeam(tx);
        const updated = await tx.user.updateMany({ where: { id: req.user!.id, authVersion: req.user!.authVersion, isActive: true },
            data: { passwordHash, authVersion: { increment: 1 } } });
        if (updated.count !== 1) throw new AppError("Votre session a changé. Reconnectez-vous.", 401);
        await tx.refreshToken.deleteMany({ where: { userId: req.user!.id } });
        await tx.passwordReset.deleteMany({ where: { userId: req.user!.id } });
        await tx.accessEvent.create({ data: { actorId: req.user!.id, action: "PASSWORD_CHANGED" } });
    }, { isolationLevel: "ReadCommitted" });
    res.json({ success: true });
}
