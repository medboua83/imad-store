import { Prisma } from "@prisma/client";
import { customerBlacklistSummaries } from "./customer-dispatch-blacklist";
import { AppError } from "../middleware/error.middleware";
import { prisma } from "./prisma";

export const CARRIER_REVIEW_REQUIRED = "Validation requise avant Olivraison : anciennes commandes annulées associées au numéro.";
export class CarrierReviewRequired extends Error {}

/** Enforced at enqueue and again immediately before every external write. Never trusts the browser. */
export async function needsCarrierApproval(tx: Prisma.TransactionClient, orderId: string) {
    const shipment = await tx.olivraisonShipment.findUnique({ where: { id: orderId }, select: { approvedAt: true } });
    if (shipment?.approvedAt) return false;
    const summary = (await customerBlacklistSummaries(tx, [orderId])).get(orderId);
    return summary?.blocked === true;
}

/** Approves one existing held queue entry; cannot backfill or recreate a remote parcel. */
export async function approveCarrierDispatch(orderId: string, actorId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return await prisma.$transaction(async tx => {
                // Serialize approval with cancellation and repeated admin clicks.
                await tx.$queryRaw(Prisma.sql`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`);
                const order = await tx.order.findUnique({ where: { id: orderId } });
                const shipment = await tx.olivraisonShipment.findUnique({ where: { id: orderId } });
                if (!order || order.deletedAt) throw new AppError("Commande introuvable", 404);
                if (order.status !== "CONFIRMED" || !shipment)
                    throw new AppError("Confirmez la commande et actualisez avant de valider l’envoi.", 409);
                if (shipment.approvedAt) return { approved: true, orderId, alreadyApproved: true };
                if (shipment.trackingId || shipment.pickupAttempted || shipment.state !== "REVIEW_REQUIRED")
                    throw new AppError("Cette commande n’attend pas de validation d’envoi. Vérifiez le colis existant.", 409);
                if (shipment.lockedUntil > new Date()) throw new AppError("Un traitement est en cours. Actualisez la commande.", 409);
                const cfg = await tx.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
                if (!cfg?.enabled || !cfg.credentials || !cfg.activatedAt || order.createdAt < cfg.activatedAt)
                    throw new AppError("La connexion Olivraison est désactivée ou cette commande est hors de sa période d’activation.", 409);
                const count = (await customerBlacklistSummaries(tx, [orderId])).get(orderId)?.cancelledCount ?? 0;
                const result = await tx.olivraisonShipment.updateMany({
                    where: { id: orderId, state: "REVIEW_REQUIRED", approvedAt: null, trackingId: null, pickupAttempted: false, lockedUntil: { lte: new Date() } },
                    data: { approvedAt: new Date(), approvedBy: actorId, state: "QUEUED", lastError: null, nextAttemptAt: new Date() },
                });
                if (!result.count) throw new AppError("Commande modifiée entre-temps. Actualisez la page.", 409);
                await tx.orderEvent.create({ data: { orderId, type: "carrier_manual_approved",
                    message: `Olivraison dispatch approved by admin ${actorId}; cancelled orders for number: ${count}` } });
                return { approved: true, orderId, alreadyApproved: false };
            }, { isolationLevel: "Serializable" });
        } catch (error) {
            if ((error as { code?: string }).code === "P2034" && attempt < 4) continue;
            throw error;
        }
    }
    throw new AppError("Actualisez la commande et réessayez", 409);
}
