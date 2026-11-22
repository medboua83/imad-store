import { needsCarrierApproval, CARRIER_REVIEW_REQUIRED } from "./carrier-approval";
import { Prisma } from "@prisma/client";
export async function enqueueOlivraison(
  tx: Prisma.TransactionClient,
  order: { id: string; createdAt: Date; status: string },
) {
  if (order.status !== "CONFIRMED") return;
  const cfg = await tx.olivraisonIntegration.findUnique({ where: { id: "olivraison" } });
  if (!cfg?.enabled || !cfg.credentials || !cfg.activatedAt || order.createdAt < cfg.activatedAt)
    return;
  // Serialize new work with configuration removal. A conflicting transaction retries safely.
  const locked = await tx.olivraisonIntegration.updateMany({
    where: { id: "olivraison", enabled: true },
    data: { updatedAt: new Date() },
  });
  if (!locked.count) return;
  const review = await needsCarrierApproval(tx, order.id);
  await tx.olivraisonShipment.upsert({
    where: { id: order.id },
    create: { id: order.id, state: review ? "REVIEW_REQUIRED" : "QUEUED", lastError: review ? CARRIER_REVIEW_REQUIRED : null },
    update: {},
  });
}
