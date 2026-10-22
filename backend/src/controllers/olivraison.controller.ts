import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { encryptDeskcommValue } from "../lib/deskcomm-config";
import { configuredClient } from "../lib/olivraison";
import { CarrierError } from "../lib/olivraison-api";
import { AppError } from "../middleware/error.middleware";

const pickupSchema = z.object({
  streetAddress: z.string().trim().min(3).max(124),
  city: z.string().trim().min(1).max(124),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d{9,12}$/),
  company: z.string().trim().min(2).max(124),
});
const configSchema = z
  .object({
    enabled: z.boolean(),
    autoPickup: z.boolean(),
    pickupAddress: pickupSchema,
    cityMapping: z
      .record(z.string().trim().min(1).max(124))
      .refine((v) => Object.keys(v).length <= 300),
    apiKey: z.string().trim().min(1).max(1000).optional(),
    secretKey: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();
export async function getOlivraisonConfig(_req: Request, res: Response) {
  const cfg = await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
  res.json({
    data: {
      enabled: cfg?.enabled ?? false,
      autoPickup: cfg?.autoPickup ?? true,
      configured: !!cfg?.credentials,
      pickupAddress: cfg?.pickupAddress ?? { streetAddress: "", city: "", phone: "", company: "" },
      cityMapping: cfg?.cityMapping ?? {},
      activatedAt: cfg?.activatedAt ?? null,
    },
  });
}
export async function putOlivraisonConfig(req: Request, res: Response) {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success)
    throw new AppError("Vérifiez les coordonnées de ramassage et la configuration Olivraison", 400);
  const b = parsed.data;
  if (!!b.apiKey !== !!b.secretKey) throw new AppError("Renseignez les deux clés ensemble", 400);
  const current = await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
  if (current?.credentials && b.apiKey) {
    const count = await prisma.olivraisonShipment.count({ where: { state: { not: "DONE" } } });
    if (count)
      throw new AppError(
        "Terminez les colis en cours avant de changer de compte transporteur",
        409,
      );
  }
  const credentials = b.apiKey
    ? encryptDeskcommValue(JSON.stringify({ apiKey: b.apiKey, secretKey: b.secretKey }))
    : current?.credentials;
  if (b.enabled && !credentials) throw new AppError("Enregistrez les clés API Olivraison", 400);
  await prisma.olivraisonIntegration.upsert({
    where: { id: "olivraison" },
    create: {
      id: "olivraison",
      enabled: b.enabled,
      autoPickup: b.autoPickup,
      pickupAddress: b.pickupAddress,
      cityMapping: b.cityMapping,
      credentials,
      activatedAt: b.enabled ? new Date() : null,
    },
    update: {
      enabled: b.enabled,
      autoPickup: b.autoPickup,
      pickupAddress: b.pickupAddress,
      cityMapping: b.cityMapping,
      ...(credentials ? { credentials } : {}),
      // Each new activation excludes orders created while disabled. No scan or backfill.
      ...(b.enabled && !current?.enabled ? { activatedAt: new Date() } : {}),
    },
  });
  return getOlivraisonConfig(req, res);
}
export async function testOlivraisonConnection(_req: Request, res: Response) {
  const cfg = await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
  if (!cfg?.credentials) throw new AppError("Clés Olivraison absentes", 400);
  try {
    const cities = await configuredClient(cfg.credentials)("/cities");
    if (!Array.isArray(cities)) throw new Error();
    res.json({ data: cities.map((c) => ({ name: String(c.name), price: Number(c.price) })) });
  } catch (err) {
    throw new AppError(
      err instanceof CarrierError ? err.reason : "Connexion Olivraison impossible",
      502,
    );
  }
}
export async function listOlivraisonShipments(_req: Request, res: Response) {
  const rows = await prisma.olivraisonShipment.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      trackingId: true,
      carrierStatus: true,
      state: true,
      attempts: true,
      lastError: true,
      stickerUrl: true,
      slipUrl: true,
      updatedAt: true,
    },
  });
  res.json({ data: rows });
}
export async function retryOlivraisonShipment(req: Request, res: Response) {
  // Wake up transient failures. ATTENTION requires reconciliation, never a forced duplicate pickup.
  const result = await prisma.olivraisonShipment.updateMany({
    where: {
      id: req.params.id,
      state: { in: ["RETRY", "ACTIVE", "ATTENTION"] },
      lockedUntil: { lte: new Date() },
    },
    data: { state: "RETRY", nextAttemptAt: new Date() },
  });
  if (!result.count)
    throw new AppError("Colis à vérifier manuellement dans Olivraison avant reprise", 409);
  res.json({ data: { scheduled: true } });
}
