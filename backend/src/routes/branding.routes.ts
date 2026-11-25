import { Router, type IRouter } from "express";
import { z } from "zod";
import { lstat } from "node:fs/promises";
import path from "node:path";
import { isBrandLogo, isBrandColor } from "@imad-store/shared";
import { authenticate, requirePermission } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { prisma } from "../lib/prisma";
import { readStoreBranding } from "../lib/store-branding";
import { uploadDirectory } from "./upload.routes";

const plain = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(v));
const brandingSchema = z.object({
    name: plain(120).min(1),
    logoUrl: z.string().max(100).refine(isBrandLogo),
    darkLogoUrl: z.string().max(100).refine(isBrandLogo),
    primaryColor: z.string().refine(isBrandColor).transform(v => v.toLowerCase()),
    accentColor: z.string().refine(isBrandColor).transform(v => v.toLowerCase()),
    backgroundColor: z.string().refine(isBrandColor).transform(v => v.toLowerCase()),
    contactEmail: z.union([z.literal(""), z.email().max(254)]),
    contactPhone: z.string().trim().max(40).regex(/^(?:\+?[0-9 ()-]{5,40})?$/)
        .refine(v => !v || v.replace(/\D/g, "").length >= 5 && v.replace(/\D/g, "").length <= 15),
    contactAddress: plain(1000),
}).strict();
export const brandingRoutes: IRouter = Router();
brandingRoutes.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
brandingRoutes.use(authenticate, requirePermission("settings.manage"));
brandingRoutes.get("/", async (_req, res) => { res.json({ success: true, data: await readStoreBranding() }); });
brandingRoutes.put("/", async (req, res) => {
    const body = z.object({ revision: z.number().int().min(0), branding: brandingSchema }).strict().parse(req.body);
    for (const url of new Set([body.branding.logoUrl, body.branding.darkLogoUrl].filter(Boolean))) {
        const info = await lstat(path.join(uploadDirectory, path.basename(url))).catch(() => null);
        if (!info?.isFile() || info.isSymbolicLink()) throw new AppError("Importez le logo avant d’enregistrer.", 400);
    }
    const result = await prisma.$transaction(async tx => {
        await tx.storeBranding.upsert({ where: { id: "store" }, create: { id: "store", data: {} }, update: {} });
        const changed = await tx.storeBranding.updateMany({ where: { id: "store", revision: body.revision },
            data: { revision: { increment: 1 }, data: body.branding } });
        if (changed.count !== 1) throw new AppError("L’identité a changé dans une autre fenêtre. Rechargez avant de réessayer.", 409);
        return { revision: body.revision + 1, branding: body.branding };
    });
    res.json({ success: true, data: result });
});
