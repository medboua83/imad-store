import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";

export async function verifyCurrentPassword(id: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user?.isActive || !await bcrypt.compare(password, user.passwordHash))
        throw new AppError("Votre mot de passe actuel est incorrect.", 400);
}
export async function lockTeam(tx: Prisma.TransactionClient, actor?: { id: string; authVersion: number }) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1229800001)`;
    if (actor) {
        const current = await tx.user.findUnique({ where: { id: actor.id } });
        if (!current?.isActive || current.role !== "ADMIN" || current.authVersion !== actor.authVersion)
            throw new AppError("Votre session a changé. Reconnectez-vous.", 401);
    }
}
export const teamSelect = { id: true, email: true, firstName: true, lastName: true, role: true,
    permissions: true, isActive: true, mustSetPassword: true, createdAt: true } as const;
