import { Response } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminPermissions } from "@imad-store/shared";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { lockTeam, teamSelect, verifyCurrentPassword } from "../lib/team-access";
import { queueAccessMail } from "../lib/password-reset";

const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const privileges = z.array(z.enum(adminPermissions)).max(adminPermissions.length).transform(v => [...new Set(v)]);
const fields = { firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().max(80),
    role: z.enum(["ADMIN", "STAFF"]), permissions: privileges,
    currentPassword: z.string().min(1).max(128) };
function validPermissions(role: string, permissions: string[]) {
    if (role === "STAFF" && !permissions.length) throw new AppError("Choisissez au moins une permission.");
    if (permissions.some(p => p === "orders.write" || p === "orders.export") && !permissions.includes("orders.read"))
        throw new AppError("Activez aussi la lecture des commandes.");
    return role === "ADMIN" ? [] : permissions;
}
async function mailReady() {
    const cfg = await prisma.gmailConfig.findUnique({ where: { id: "gmail" } });
    if (!cfg?.enabled || !cfg.passwordCiphertext) throw new AppError("Configurez Gmail SMTP avant d’envoyer une invitation.", 409);
}
export async function listTeam(req: AuthRequest, res: Response) {
    const q = z.object({ page: z.coerce.number().int().min(1).max(1000000).default(1) }).strict().parse(req.query);
    const result = await prisma.$transaction(async tx => {
        const where = { role: { in: ["ADMIN", "STAFF"] as ("ADMIN" | "STAFF")[] } };
        const total = await tx.user.count({ where }), totalPages = Math.max(1, Math.ceil(total / 25));
        const page = Math.min(q.page, totalPages);
        const data = await tx.user.findMany({ where, select: teamSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25 });
        const jobs = await tx.passwordReset.findMany({ where: { userId: { in: data.map(user => user.id) } }, select: { userId: true, mailState: true } });
        const states = new Map(jobs.map(job => [job.userId, job.mailState]));
        return { data: data.map(user => ({ ...user, mailState: states.get(user.id) ?? null })), total, page, totalPages, currentUserId: req.user!.id };
    }, { isolationLevel: "RepeatableRead" });
    res.json({ success: true, ...result });
}
export async function createTeamUser(req: AuthRequest, res: Response) {
    const body = z.object({ ...fields, email }).strict().parse(req.body);
    await verifyCurrentPassword(req.user!.id, body.currentPassword);
    const permissions = validPermissions(body.role, body.permissions);
    await mailReady();
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
    const user = await prisma.$transaction(async tx => {
        await lockTeam(tx, req.user!);
        if (await tx.user.findFirst({ where: { email: { equals: body.email, mode: "insensitive" } } }))
            throw new AppError("Cette adresse est déjà utilisée. Retrouvez le compte dans l’équipe.", 409);
        const user = await tx.user.create({ data: { email: body.email, firstName: body.firstName, lastName: body.lastName,
            role: body.role, permissions, passwordHash, mustSetPassword: true }, select: { ...teamSelect, authVersion: true } });
        await queueAccessMail(tx, user, "INVITE");
        await tx.accessEvent.create({ data: { actorId: req.user!.id, targetId: user.id, action: "TEAM_USER_CREATED" } });
        return user;
    }, { isolationLevel: "ReadCommitted" });
    const { authVersion: _version, ...visible } = user;
    res.status(201).json({ success: true, data: visible, invitationQueued: true });
}
export async function updateTeamUser(req: AuthRequest, res: Response) {
    const id = z.string().regex(/^[a-f0-9]{24}$/).parse(req.params.id);
    const body = z.object({ ...fields, isActive: z.boolean() }).strict().parse(req.body);
    await verifyCurrentPassword(req.user!.id, body.currentPassword);
    if (id === req.user!.id) throw new AppError("Utilisez Mon compte pour votre mot de passe. Votre propre accès ne peut pas être retiré ici.", 409);
    const permissions = validPermissions(body.role, body.permissions);
    const user = await prisma.$transaction(async tx => {
        await lockTeam(tx, req.user!);
        const target = await tx.user.findUnique({ where: { id } });
        if (!target || target.role === "CUSTOMER") throw new AppError("Compte introuvable.", 404);
        if (target.role === "ADMIN" && target.isActive && (!body.isActive || body.role !== "ADMIN")
            && await tx.user.count({ where: { role: "ADMIN", isActive: true, mustSetPassword: false } }) <= 1)
            throw new AppError("Conservez au moins un administrateur actif.", 409);
        const updated = await tx.user.update({ where: { id }, data: { firstName: body.firstName, lastName: body.lastName,
            role: body.role, permissions, isActive: body.isActive, authVersion: { increment: 1 } }, select: teamSelect });
        await tx.refreshToken.deleteMany({ where: { userId: id } });
        await tx.passwordReset.deleteMany({ where: { userId: id } });
        await tx.accessEvent.create({ data: { actorId: req.user!.id, targetId: id, action: "TEAM_ACCESS_UPDATED" } });
        return updated;
    }, { isolationLevel: "ReadCommitted" });
    res.json({ success: true, data: user });
}
export async function inviteTeamUser(req: AuthRequest, res: Response) {
    const id = z.string().regex(/^[a-f0-9]{24}$/).parse(req.params.id);
    const body = z.object({ currentPassword: z.string().min(1).max(128) }).strict().parse(req.body);
    await verifyCurrentPassword(req.user!.id, body.currentPassword); await mailReady();
    await prisma.$transaction(async tx => {
        await lockTeam(tx, req.user!);
        const user = await tx.user.findUnique({ where: { id } });
        if (!user?.isActive || user.role === "CUSTOMER") throw new AppError("Compte actif introuvable.", 404);
        const previous = await tx.passwordReset.findUnique({ where: { userId: id } });
        if (previous && previous.requestedAt.getTime() > Date.now() - 60000) throw new AppError("Patientez une minute avant un nouvel envoi.", 429);
        await queueAccessMail(tx, user, user.mustSetPassword ? "INVITE" : "RESET");
        await tx.accessEvent.create({ data: { actorId: req.user!.id, targetId: id, action: "TEAM_ACCESS_MAIL_QUEUED" } });
    }, { isolationLevel: "ReadCommitted" });
    res.status(202).json({ success: true, invitationQueued: true });
}
