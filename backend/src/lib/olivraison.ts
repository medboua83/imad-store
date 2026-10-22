import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { decryptDeskcommValue } from "./deskcomm-config";
import { transitionOrderStatus } from "./order-lifecycle";
import {
  CarrierError,
  CarrierRequest,
  createCarrierClient,
  documentUrl,
  packagePayload,
  resolveCity,
} from "./olivraison-api";

// Distributed request gate: all app instances share a maximum of four calls per second.
export async function carrierGate() {
  for (let n = 0; n < 100; n++) {
    const now = new Date();
    const claim = await prisma.olivraisonIntegration.updateMany({
      where: { id: "olivraison", nextRequestAt: { lte: now } },
      data: { nextRequestAt: new Date(now.getTime() + 260) },
    });
    if (claim.count === 1) return;
    await new Promise((r) => setTimeout(r, 270));
  }
  throw new CarrierError("Limite de débit Olivraison : reprise automatique", true);
}
export function configuredClient(ciphertext: string) {
  return createCarrierClient(JSON.parse(decryptDeskcommValue(ciphertext)), carrierGate);
}
const terminal = new Set(["DELIVERED", "RETURNED", "DELETED", "CUSTOMER_CANCELED", "ARCHIVED"]);
const moving = new Set([
  "PICKEDUP",
  "PICKED_UP",
  "TRANSIT",
  "RECIVED",
  "SCHEDULED",
  "REPORTED",
  "DELIVERED",
]);

/** One leased shipment per tick; checkpoints precede every irreversible request. */
export async function processOlivraisonQueue(injected?: CarrierRequest) {
  const cfg = await prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
  if (!cfg?.enabled || !cfg.credentials || !cfg.activatedAt) return;
  const now = new Date();
  const candidate = await prisma.olivraisonShipment.findFirst({
    where: {
      state: { in: ["QUEUED", "ACTIVE", "RETRY"] },
      nextAttemptAt: { lte: now },
      lockedUntil: { lte: now },
    },
    orderBy: { nextAttemptAt: "asc" },
  });
  if (!candidate) return;
  const leaseToken = randomUUID();
  const owned = { id: candidate.id, leaseToken };
  const claim = await prisma.olivraisonShipment.updateMany({
    where: { id: candidate.id, lockedUntil: { lte: now }, state: candidate.state },
    data: {
      leaseToken,
      lockedUntil: new Date(now.getTime() + 300_000),
      attempts: { increment: 1 },
    },
  });
  if (claim.count !== 1) return;

  async function save(data: Prisma.OlivraisonShipmentUpdateManyMutationInput) {
    const result = await prisma.olivraisonShipment.updateMany({ where: owned, data });
    if (result.count !== 1) throw new CarrierError("Traitement repris par un autre processus");
  }
  async function eligible() {
    const [current, lease, order] = await Promise.all([
      prisma.olivraisonIntegration.findUnique({ where: { id: "olivraison" } }),
      prisma.olivraisonShipment.findFirst({ where: { ...owned, lockedUntil: { gt: new Date() } } }),
      prisma.order.findUnique({
        where: { id: candidate!.id },
        include: { items: { include: { product: true } } },
      }),
    ]);
    if (!current?.enabled || !lease) throw new CarrierError("Automatisation suspendue");
    if (!order || order.deletedAt || !["CONFIRMED", "SHIPPED", "DELIVERED"].includes(order.status))
      throw new CarrierError(
        "Commande annulée ou non éligible : vérifier le colis chez Olivraison avant toute reprise.",
      );
    return order;
  }
  try {
    const api = injected || configuredClient(cfg.credentials);
    let order = await eligible();
    let trackingId = candidate.trackingId;
    if (!trackingId) {
      const cities = await api("/cities");
      if (!Array.isArray(cities) || cities.some((c) => typeof c.name !== "string"))
        throw new CarrierError("Liste des villes Olivraison invalide", true);
      const city = resolveCity(
        order.city || "",
        cities,
        (cfg.cityMapping || {}) as Record<string, string>,
      );
      const payload = packagePayload(order, city, cfg.pickupAddress);
      await eligible();
      // The carrier documents orderId as its idempotency identifier. It is stable on every retry.
      const created = await api("/package/new", "POST", payload);
      if (typeof created.trackingID !== "string" || !created.trackingID)
        throw new CarrierError("Création non rapprochée : vérifier le compte Olivraison");
      trackingId = created.trackingID;
      await save({ trackingId, state: "ACTIVE", carrierStatus: created.status || "CREATED" });
    }
    if (!trackingId) throw new CarrierError("Référence de colis absente");
    let remote = await api(`/package/${encodeURIComponent(trackingId)}`);
    if (remote.trackingID !== trackingId || typeof remote.status !== "string")
      throw new CarrierError("Réponse de suivi Olivraison invalide", true);
    if (remote.partnerTrackingID !== order.id)
      throw new CarrierError("Référence transporteur différente : rapprochement requis");
    if (remote.status === "CREATED") {
      await eligible();
      await api("/package/status", "POST", { trackingID: trackingId, status: "CONFIRMED" });
      remote = { ...remote, status: "CONFIRMED" };
    }
    await save({ carrierStatus: remote.status });
    if (cfg.autoPickup && remote.status === "CONFIRMED") {
      await eligible();
      // A timeout/crash after this checkpoint is reconciled by GET, never blindly replayed.
      if (candidate.pickupAttempted)
        throw new CarrierError(
          "Ramassage non rapproché : vérifier Olivraison et les bordereaux avant reprise",
        );
      await save({ pickupAttempted: true });
      const pickup = await api("/pickup", "POST", { packages: [trackingId] });
      if (
        !Array.isArray(pickup.packages) ||
        !pickup.packages.some((p: any) => p.trackingID === trackingId && p.status === "PICKUP")
      )
        throw new CarrierError("Demande de ramassage non confirmée : vérifier Olivraison");
      const stickerUrl = documentUrl(pickup.miniStickerFilePath),
        slipUrl = documentUrl(pickup.slipFilePath);
      await save({ carrierStatus: "PICKUP", stickerUrl, slipUrl });
      if (!stickerUrl || !slipUrl)
        throw new CarrierError("Ramassage créé, bordereaux à récupérer dans le compte Olivraison");
      remote = { ...remote, status: "PICKUP" };
    }
    order = await eligible();
    if (moving.has(remote.status) && order.status === "CONFIRMED") {
      await transitionOrderStatus(order.id, "SHIPPED", "olivraison");
      order = await eligible();
    }
    if (remote.status === "DELIVERED" && order.status === "SHIPPED")
      await transitionOrderStatus(order.id, "DELIVERED", "olivraison");
    // Delivery is not proof of COD remittance. Never change paymentStatus or replenish stock here.
    const needsReview = ["CANCELED", "RETURNED", "DELETED", "CUSTOMER_CANCELED"].includes(
      remote.status,
    );
    const missingDocuments =
      cfg.autoPickup &&
      remote.status === "PICKUP" &&
      candidate.pickupAttempted &&
      !candidate.slipUrl;
    await save({
      state:
        needsReview || missingDocuments
          ? "ATTENTION"
          : terminal.has(remote.status)
            ? "DONE"
            : "ACTIVE",
      lastError: needsReview
        ? "Incident transporteur : rapprocher la commande, le stock et le paiement."
        : missingDocuments
          ? "Ramassage effectué : récupérer les bordereaux dans Olivraison."
          : null,
      nextAttemptAt: new Date(Date.now() + 300_000),
    });
  } catch (error) {
    const retry = error instanceof CarrierError && error.retryable;
    await save({
      state: retry ? "RETRY" : "ATTENTION",
      lastError:
        error instanceof CarrierError
          ? error.reason
          : "Erreur interne : consulter les journaux techniques sans données client.",
      nextAttemptAt: new Date(
        Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(candidate.attempts, 7)),
      ),
    });
  } finally {
    await prisma.olivraisonShipment.updateMany({
      where: owned,
      data: { leaseToken: null, lockedUntil: new Date(0) },
    });
  }
}
