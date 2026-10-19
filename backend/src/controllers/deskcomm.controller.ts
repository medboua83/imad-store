import { Request, Response } from "express";
import { encryptDeskcommValue as encrypt, decryptDeskcommValue } from "../lib/deskcomm-config";
import { storeIdentity } from "../lib/store-installation";
import { AppError } from "../middleware/error.middleware";
import { z } from "zod";
import { crmStatusConfig } from "./deskcomm-status.controller";
import { prisma } from "../lib/prisma";
const schema = z
    .object({
        enabled: z.boolean(),
        webhookUrl: z.string().trim().max(2048).optional(),
        clearWebhook: z.boolean().optional(),
    })
    .strict();
function validateUrl(value: string) {
    const url = new URL(value);
    const allowDevHttp =
        process.env.NODE_ENV !== "production" && process.env.DESKCOMM_ALLOW_HTTP_DEV === "true";
    if (
        !(url.protocol === "https:" || (url.protocol === "http:" && allowDevHttp)) ||
        url.username ||
        url.password ||
        url.hash
    )
        throw new Error("HTTPS obligatoire ; HTTP uniquement pour test local explicitement active");
    if (
        ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname) &&
        !(url.protocol === "http:" && allowDevHttp)
    )
        throw new Error("Adresse locale interdite pour un webhook distant");
}
function workerStatus() {
    const cutoff = process.env.DESKCOMM_OUTBOX_MIN_CREATED_AT;
    const validCutoff = Boolean(
        cutoff &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff) &&
        Number.isFinite(Date.parse(cutoff)) &&
        new Date(cutoff).toISOString() === cutoff,
    );
    return {
        hosted: process.env.IMAD_HOSTING_MODE === "combined",
        enabled: process.env.DESKCOMM_OUTBOX_WORKER_ENABLED === "true",
        hostedEnabled: process.env.DESKCOMM_HOSTED_DELIVERY_ENABLED === "true",
        cutoffConfigured: validCutoff,
        scheduled: Boolean(
            (globalThis as unknown as Record<symbol, unknown>)[Symbol.for("imad.hostedCrmWorker")],
        ),
    };
}
export async function getDeskcommOrderStatus(req: Request, res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const reference = String(req.params.reference).trim().toLowerCase();
    if (!/^(?:[a-f0-9]{8}|[a-f0-9]{24})$/.test(reference)) {
        res.status(400).json({
            success: false,
            error: "Référence attendue : 8 ou 24 caractères hexadécimaux",
        });
        return;
    }
    const matches =
        reference.length === 24
            ? [
                  await prisma.order.findUnique({ where: { id: reference }, select: { id: true } }),
              ].filter(Boolean)
            : (
                  await prisma.order.findMany({
                      orderBy: { createdAt: "desc" },
                      take: 100,
                      select: { id: true },
                  })
              ).filter((order) => order.id.endsWith(reference));
    if (matches.length !== 1) {
        res.status(matches.length ? 409 : 404).json({
            success: false,
            error: matches.length
                ? "Utilisez l'identifiant complet"
                : "Commande introuvable parmi les 100 plus récentes ; utilisez l'identifiant complet",
        });
        return;
    }
    const id = matches[0]!.id;
    const job = await prisma.deskcommOutbox.findUnique({
        where: { orderId: id },
        select: {
            status: true,
            attempts: true,
            createdAt: true,
            updatedAt: true,
            nextAttemptAt: true,
        },
    });
    res.json({
        success: true,
        data: {
            reference: id.slice(-8).toUpperCase(),
            state: job?.status || "NO_EVENT",
            attempts: job?.attempts || 0,
            createdAt: job?.createdAt || null,
            updatedAt: job?.updatedAt || null,
            nextAttemptAt: job?.nextAttemptAt || null,
        },
    });
}
export async function getDeskcommConfig(_req: Request, res: Response) {
    const c = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    res.setHeader("Cache-Control", "no-store");
    res.json({
        success: true,
        data: {
            enabled: c?.enabled ?? false,
            configured: Boolean(c?.webhookCiphertext),
            updatedAt: c?.updatedAt ?? null,
            worker: workerStatus(),
            confirmationSync: Boolean(await crmStatusConfig()),
            connection: await publicConnection(),
        },
    });
}
export async function putDeskcommConfig(req: Request, res: Response) {
    const b = schema.parse(req.body);
    if (storeIdentity() && (b.clearWebhook || b.webhookUrl)) {
        const existing = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
        const replacing =
            existing?.webhookCiphertext &&
            (b.clearWebhook ||
                (b.webhookUrl &&
                    b.webhookUrl !== decryptDeskcommValue(existing.webhookCiphertext)));
        if (replacing && (await prisma.deskcommOutbox.count()))
            throw new AppError(
                "Cette boutique est liée à sa source CRM. Utilisez une nouvelle installation pour une autre entreprise.",
                409,
            );
    }
    if (b.clearWebhook && b.webhookUrl) {
        res.status(400).json({ success: false, error: "Choisir suppression ou remplacement" });
        return;
    }
    const cur = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    let cipher = cur?.webhookCiphertext ?? null;
    if (b.clearWebhook) cipher = null;
    if (b.webhookUrl) {
        try {
            validateUrl(b.webhookUrl);
            cipher = encrypt(b.webhookUrl);
        } catch (e) {
            res.status(400).json({
                success: false,
                error: e instanceof Error ? e.message : "Invalid URL",
            });
            return;
        }
    }
    if (b.enabled && !cipher) {
        res.status(400).json({ success: false, error: "Saisir une URL avant activation" });
        return;
    }
    const c = await prisma.deskcommIntegration.upsert({
        where: { id: "deskcomm" },
        create: { id: "deskcomm", enabled: b.enabled, webhookCiphertext: cipher },
        update: { enabled: b.enabled, webhookCiphertext: cipher },
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({
        success: true,
        data: {
            enabled: c.enabled,
            configured: Boolean(c.webhookCiphertext),
            updatedAt: c.updatedAt,
            worker: workerStatus(),
            confirmationSync: Boolean(await crmStatusConfig()),
            connection: await publicConnection(),
        },
    });
}

const connectionInput = z
    .object({
        enabled: z.boolean(),
        pipeline: z.string().uuid(),
        stage: z.string().uuid(),
        field: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
        secret: z
            .string()
            .regex(/^[a-f0-9]{64}$/i)
            .optional(),
    })
    .strict();
async function publicConnection() {
    const identity = storeIdentity();
    if (!identity) return null;
    const saved = await prisma.deskcommConnection.findUnique({ where: { id: "deskcomm" } });
    if (!saved)
        return {
            ...identity,
            enabled: false,
            configured: false,
            pipeline: "",
            stage: "",
            field: "pedido_id",
        };
    const c = JSON.parse(decryptDeskcommValue(saved.ciphertext));
    return {
        ...identity,
        enabled: c.enabled,
        configured: true,
        pipeline: c.pipeline,
        stage: c.stage,
        field: c.field,
    };
}
export async function putDeskcommConnection(req: Request, res: Response) {
    const identity = storeIdentity();
    if (!identity)
        throw new AppError(
            "Installez un profil entreprise indépendant avant de configurer cette connexion",
            409,
        );
    const input = connectionInput.parse(req.body);
    const saved = await prisma.deskcommConnection.findUnique({ where: { id: "deskcomm" } });
    const previous = saved ? JSON.parse(decryptDeskcommValue(saved.ciphertext)) : null;
    if (previous && (previous.pipeline !== input.pipeline || previous.field !== input.field))
        throw new AppError(
            "Le pipeline et le champ de référence sont liés à cette installation",
            409,
        );
    const secret = input.secret || previous?.secret;
    if (!secret) throw new AppError("Une clé de signature dédiée est requise", 400);
    const config = {
        ...identity,
        ...input,
        secret,
        cutoff: previous?.cutoff || new Date().toISOString(),
    };
    const ciphertext = encrypt(JSON.stringify(config));
    if (saved) {
        const updated = await prisma.deskcommConnection.updateMany({
            where: { id: "deskcomm", ciphertext: saved.ciphertext },
            data: { ciphertext },
        });
        if (updated.count !== 1)
            throw new AppError("Configuration modifiée entre-temps. Actualisez.", 409);
    } else {
        await prisma.deskcommConnection.create({ data: { id: "deskcomm", ciphertext } });
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: await publicConnection() });
}
