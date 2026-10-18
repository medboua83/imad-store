import { createDecipheriv } from "crypto";
import { prisma } from "./prisma";
export async function resolveDeskcommWebhookUrl(): Promise<string | undefined> {
  const cfg = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
  if (!cfg?.enabled || !cfg.webhookCiphertext) return undefined;
  const raw = process.env.DESKCOMM_ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error("Deskcomm encryption key missing");
  const [iv, tag, data] = cfg.webhookCiphertext.split(".");
  if (!iv || !tag || !data) throw new Error("Invalid encrypted webhook configuration");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(raw, "hex"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
