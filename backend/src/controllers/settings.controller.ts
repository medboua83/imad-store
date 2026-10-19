import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export async function readSettings() {
    const settings = (await prisma.storeSettings.findUnique({ where: { id: "settings" } })) || {
        id: "settings",
        whatsappPhone: "212660560522",
        shippingCost: 30,
        freeShippingMin: 500,
        codEnabled: true,
    };
    const integration = await prisma.deskcommIntegration.findUnique({
        where: { id: "deskcomm" },
        select: { enabled: true, webhookCiphertext: true, signingCiphertext: true },
    });
    return {
        success: true,
        data: {
            ...settings,
            whatsappAssistanceAvailable: Boolean(
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

const settingsSchema = z.object({
    whatsappPhone: z.string().optional(),
    shippingCost: z.number().min(0).max(1000000).optional(),
    freeShippingMin: z.number().min(0).max(1000000).optional(),
    codEnabled: z.boolean().optional(),
});

export async function updateSettings(req: Request, res: Response) {
    const body = settingsSchema.parse(req.body);
    const settings = await prisma.storeSettings.upsert({
        create: { id: "settings", ...body },
        where: { id: "settings" },
        update: body,
    });
    res.json({ success: true, data: settings });
}
