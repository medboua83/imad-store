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
  await tx.olivraisonShipment.upsert({
    where: { id: order.id },
    create: { id: order.id },
    update: {},
  });
}
