import { Request, Response } from "express";
import { createCipheriv, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const schema = z.object({
  enabled: z.boolean(),
  webhookUrl: z.string().trim().max(2048).optional(),
  clearWebhook: z.boolean().optional(),
}).strict();

function encryptionKey(): Buffer {
  const raw = process.env.DESKCOMM_ENCRYPTION_KEY;
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("DESKCOMM_ENCRYPTION_KEY must be 32 bytes encoded as 64 hexadecimal characters");
  }
  return Buffer.from(raw, "hex");
}
function encrypt(value: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), ciphertext].map(v => v.toString("base64url")).join(".");
}
function validateWebhook(value: string) {
  const parsed = new URL(value);
  const isLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.hash || !["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Invalid webhook URL");
  }
  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && isLocal)) {
    throw new Error("HTTPS is required for external webhooks");
  }
}

export async function getDeskcommConfig(_req: Request, res: Response) {
  const config = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: { enabled: config?.enabled ?? false, configured: Boolean(config?.webhookCiphertext), updatedAt: config?.updatedAt ?? null } });
}

export async function putDeskcommConfig(req: Request, res: Response) {
  const body = schema.parse(req.body);
  const current = await prisma.deskcommIntegration.findUnique({ where: { id: "deskcomm" } });
  if (body.clearWebhook && body.webhookUrl) {
    res.status(400).json({ success: false, error: "Cannot clear and replace simultaneously" });
    return;
  }
  let webhookCiphertext = current?.webhookCiphertext ?? null;
  if (body.clearWebhook) webhookCiphertext = null;
  if (body.webhookUrl) {
    try { validateWebhook(body.webhookUrl); webhookCiphertext = encrypt(body.webhookUrl); }
    catch (error) { res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid URL" }); return; }
  }
  if (body.enabled && !webhookCiphertext) {
    res.status(400).json({ success: false, error: "Configure a webhook before enabling" });
    return;
  }
  const config = await prisma.deskcommIntegration.upsert({
    where: { id: "deskcomm" },
    create: { id: "deskcomm", enabled: body.enabled, webhookCiphertext },
    update: { enabled: body.enabled, webhookCiphertext },
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, data: { enabled: config.enabled, configured: Boolean(config.webhookCiphertext), updatedAt: config.updatedAt } });
}
