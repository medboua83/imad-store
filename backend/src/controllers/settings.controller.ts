import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
    defaultStoreContacts,
    normalizeMetaDomainVerification,
    normalizeStoreContact,
    storeContacts,
    type StoreContactKey,
} from "@imad-store/shared";

export async function readSettings() {
    const settings = (await prisma.storeSettings.findUnique({ where: { id: "settings" } })) || {
        id: "settings",
        ...defaultStoreContacts,
        whatsappPhone: "212660560522",
        shippingCost: 30,
        freeShippingMin: 500,
        codEnabled: true,
        directSiteConfirmation: false,
        metaPixelEnabled: false,
        metaPixelId: null,
        metaDomainVerification: null,
    };
    const integration = await prisma.deskcommIntegration.findUnique({
        where: { id: "deskcomm" },
        select: {
            enabled: true,
            webhookCiphertext: true,
            signingCiphertext: true,
            orderAssistanceEnabled: true,
        },
    });
    return {
        success: true,
        data: {
            ...settings,
            ...storeContacts(settings),
            directSiteConfirmation: settings.directSiteConfirmation === true,
            whatsappAssistanceAvailable: Boolean(
                !settings.directSiteConfirmation &&
                integration?.orderAssistanceEnabled !== false &&
                integration?.enabled &&
                integration.webhookCiphertext &&
                integration.signingCiphertext,
            ),
        },
    };
}
export async function getSettings(_req: Request, res: Response) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.json(await readSettings());
}

const contactField = (key: StoreContactKey) =>
    z
        .string()
        .max(2048)
        .refine(
            (value) => normalizeStoreContact(key, value) !== null,
            "Lien du réseau invalide. Utilisez son adresse HTTPS officielle.",
        )
        .transform((value) => normalizeStoreContact(key, value)!)
        .optional();
const settingsSchema = z.object({
    metaDomainVerification: z.string().max(512).nullable()
        .refine((value) => normalizeMetaDomainVerification(value) !== null, "Code de vérification Meta invalide")
        .transform((value) => normalizeMetaDomainVerification(value) || null).optional(),
    whatsappUrl: contactField("whatsappUrl"),
    instagramUrl: contactField("instagramUrl"),
    facebookUrl: contactField("facebookUrl"),
    tiktokUrl: contactField("tiktokUrl"),
    whatsappPhone: z.string().optional(),
    shippingCost: z.number().min(0).max(1000000).optional(),
    freeShippingMin: z.number().min(0).max(1000000).optional(),
    deliveryMaxDays: z.number().int().min(1).max(365).nullable().optional(),
    returnWindowDays: z.number().int().min(1).max(365).nullable().optional(),
    returnFeePayer: z
        .enum(["STORE", "CUSTOMER", "BY_REASON", "DELIVERY_TRY_ON"])
        .nullable()
        .optional(),
    codEnabled: z.boolean().optional(),
    directSiteConfirmation: z.boolean().optional(),
    metaPixelEnabled: z.boolean().optional(),
    metaPixelMadPerUsd: z.number().finite().min(0.000001).max(1000000).nullable().optional(),
    metaPixelId: z
        .string()
        .trim()
        .regex(/^(?:[0-9]{5,25})?$/, "Identifiant Meta Pixel invalide")
        .nullable()
        .optional(),
});

export async function updateSettings(req: Request, res: Response) {
    const body = settingsSchema.parse(req.body);
    const current = await prisma.storeSettings.findUnique({ where: { id: "settings" } });
    const pixelId = body.metaPixelId !== undefined ? body.metaPixelId : current?.metaPixelId;
    if ((body.metaPixelEnabled ?? current?.metaPixelEnabled) && !pixelId)
        return res
            .status(400)
            .json({ error: "Renseignez un identifiant Meta Pixel avant activation." });
    const settings = await prisma.storeSettings.upsert({
        create: { id: "settings", ...body },
        where: { id: "settings" },
        update: body,
    });
    res.json({ success: true, data: settings });
}
