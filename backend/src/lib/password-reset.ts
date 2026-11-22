import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { encryptMail, sendAccessMail } from "./gmail-smtp";
import { decryptDeskcommValue } from "./deskcomm-config";

export const resetHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function queueAccessMail(tx: Prisma.TransactionClient, user: { id: string; authVersion: number }, kind = "RESET") {
    const token = randomBytes(32).toString("base64url"), tokenHash = resetHash(token);
    const record = { tokenHash, userId: user.id, authVersion: user.authVersion,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), requestedAt: new Date(),
        mailCiphertext: encryptMail(token), mailState: "PENDING", claimedAt: null, kind };
    await tx.passwordReset.upsert({ where: { userId: user.id }, create: record, update: record });
}

// Persisted queue, bounded claim, no automatic retry after an ambiguous SMTP send.
export async function processAccessMail(send = sendAccessMail) {
    const now = new Date();
    await prisma.passwordReset.updateMany({ where: { expiresAt: { lte: now }, mailState: { not: "EXPIRED" } },
        data: { mailState: "EXPIRED", mailCiphertext: null } });
    await prisma.passwordReset.updateMany({ where: { mailState: "SENDING", claimedAt: { lt: new Date(Date.now() - 120000) } },
        data: { mailState: "FAILED", mailCiphertext: null } });
    await prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400000) } } });
    const cfg = await prisma.gmailConfig.findUnique({ where: { id: "gmail" } });
    if (!cfg?.enabled || !cfg.passwordCiphertext) return;
    const jobs = await prisma.passwordReset.findMany({ where: { mailState: "PENDING", expiresAt: { gt: now } }, orderBy: { requestedAt: "asc" }, take: 3 });
    for (const job of jobs) {
        const claim = await prisma.passwordReset.updateMany({ where: { tokenHash: job.tokenHash, mailState: "PENDING" }, data: { mailState: "SENDING", claimedAt: new Date() } });
        if (!claim.count) continue;
        let state = "FAILED";
        try {
            const user = await prisma.user.findUnique({ where: { id: job.userId } });
            if (user?.isActive && ["ADMIN", "STAFF"].includes(user.role) && user.authVersion === job.authVersion && job.mailCiphertext) {
                await send(user.email, decryptDeskcommValue(job.mailCiphertext), job.kind, job.tokenHash);
                state = "SENT";
            }
        } catch { /* No address, credential or reset link in logs. The user may request a fresh link. */ }
        await prisma.passwordReset.updateMany({ where: { tokenHash: job.tokenHash }, data: { mailState: state, mailCiphertext: null } });
    }
}
