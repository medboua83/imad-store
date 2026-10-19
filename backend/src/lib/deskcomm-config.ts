import { createCipheriv, randomBytes, createDecipheriv } from "crypto";
import { prisma } from "./prisma";
export async function resolveDeskcommWebhookUrl(): Promise<string | undefined> {
    const cfg = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
    if (!cfg?.enabled || !cfg.webhookCiphertext) return undefined;
    return decryptDeskcommValue(cfg.webhookCiphertext);
}

export function decryptDeskcommValue(value: string): string {
    const raw = process.env.DESKCOMM_ENCRYPTION_KEY;
    if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("Deskcomm encryption key missing");
    const [iv, tag, data] = value.split(".");
    if (!iv || !tag || !data) throw new Error("Invalid encrypted webhook configuration");
    const decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(raw, "hex"),
        Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
        decipher.update(Buffer.from(data, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}

export function encryptDeskcommValue(value: string): string {
    const raw = process.env.DESKCOMM_ENCRYPTION_KEY;
    if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("DESKCOMM_ENCRYPTION_KEY invalid");
    const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", Buffer.from(raw, "hex"), iv);
    const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes].map((b) => b.toString("base64url")).join(".");
}
