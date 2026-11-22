import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { encryptMail, gmailTransport } from "../lib/gmail-smtp";
import { verifyCurrentPassword, lockTeam } from "../lib/team-access";

export async function readGmail(req: AuthRequest, res: Response) {
    const row = await prisma.gmailConfig.findUnique({ where: { id: "gmail" } });
    res.json({ success: true, data: { enabled: row?.enabled ?? false, gmailUser: row?.gmailUser ?? req.user!.email,
        host: "smtp.gmail.com", port: row?.port ?? 465, hasPassword: !!row?.passwordCiphertext, revision: row?.revision ?? 0 } });
}
export async function saveGmail(req: AuthRequest, res: Response) {
    const body = z.object({ enabled: z.boolean(), gmailUser: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
        port: z.union([z.literal(465), z.literal(587)]), appPassword: z.string().max(64).default(""),
        clearPassword: z.boolean().default(false), revision: z.number().int().min(0), currentPassword: z.string().min(1).max(128) }).strict().parse(req.body);
    await verifyCurrentPassword(req.user!.id, body.currentPassword);
    const secret = body.appPassword.replace(/\s/g, "");
    if (secret && !/^[a-zA-Z0-9]{16}$/.test(secret)) throw new AppError("Utilisez le mot de passe d’application Google de 16 caractères.");
    if (secret && body.clearPassword) throw new AppError("Choisissez un nouveau mot de passe ou son effacement.");
    const encrypted = secret ? encryptMail(secret) : undefined;
    await prisma.$transaction(async tx => {
        await lockTeam(tx, req.user!);
        const row = await tx.gmailConfig.findUnique({ where: { id: "gmail" } });
        if ((row?.revision ?? 0) !== body.revision) throw new AppError("Les réglages ont changé. Rechargez la configuration.", 409);
        if (row && row.gmailUser !== body.gmailUser && !secret && !body.clearPassword)
            throw new AppError("Renseignez un nouveau mot de passe d’application pour cette adresse.");
        const passwordCiphertext = body.clearPassword ? null : encrypted ?? row?.passwordCiphertext ?? null;
        if (body.enabled && !passwordCiphertext) throw new AppError("Renseignez le mot de passe d’application avant d’activer Gmail.");
        const data = { enabled: body.enabled, gmailUser: body.gmailUser, port: body.port, passwordCiphertext };
        if (row) {
            const updated = await tx.gmailConfig.updateMany({ where: { id: "gmail", revision: body.revision }, data: { ...data, revision: { increment: 1 } } });
            if (updated.count !== 1) throw new AppError("Les réglages ont changé. Rechargez la configuration.", 409);
        } else await tx.gmailConfig.create({ data });
        await tx.accessEvent.create({ data: { actorId: req.user!.id, action: "GMAIL_CONFIG_UPDATED" } });
    }, { isolationLevel: "ReadCommitted" });
    await readGmail(req, res);
}
export async function testGmail(_req: AuthRequest, res: Response) {
    const { transport } = await gmailTransport();
    try { await transport.verify(); }
    catch { throw new AppError("Connexion Gmail impossible. Vérifiez le mot de passe d’application et la validation en deux étapes.", 502); }
    finally { transport.close(); }
    res.json({ success: true, data: { connected: true, emailSent: false } });
}
