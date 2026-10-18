import { OrderStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";

export const orderInclude = {
    items: {
        include: {
            product: { select: { nameFr: true, nameAr: true, nameEn: true, images: true } },
            variant: { select: { colorNameFr: true, colorNameAr: true, size: true } },
        },
    },
} as const;
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
};

/** One transaction and a compare-and-set protect repeated/concurrent cancellations. */
export async function transitionOrderStatus(
    id: string,
    nextStatus: OrderStatus,
    source: "admin" | "sheets" = "admin",
) {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return await prisma.$transaction(async (tx) => {
                const order = await tx.order.findUnique({ where: { id }, include: orderInclude });
                if (!order) throw new AppError("Commande introuvable", 404);
                if (order.status === nextStatus) return { order, changed: false };
                if (!transitions[order.status].includes(nextStatus))
                    throw new AppError("Changement de statut non autorisé", 409);
                if (nextStatus === "CANCELLED" && order.inventoryReserved === null) {
                    throw new AppError(
                        "Réservation historique non vérifiée : rapprocher le stock avant annulation",
                        409,
                    );
                }
                const claimed = await tx.order.updateMany({
                    where: { id, status: order.status },
                    data: {
                        status: nextStatus,
                        ...(nextStatus === "CANCELLED" ? { inventoryReserved: false } : {}),
                    },
                });
                if (claimed.count !== 1)
                    throw new AppError("Commande modifiée entre-temps. Actualisez la page.", 409);
                if (nextStatus === "CANCELLED" && order.inventoryReserved) {
                    const quantities = new Map<string, number>();
                    for (const item of order.items)
                        quantities.set(
                            item.variantId,
                            (quantities.get(item.variantId) ?? 0) + item.quantity,
                        );
                    for (const [variantId, quantity] of quantities) {
                        await tx.productVariant.update({
                            where: { id: variantId },
                            data: { stock: { increment: quantity } },
                        });
                    }
                    await tx.deskcommOutbox.updateMany({
                        where: { orderId: id, status: "PENDING" },
                        data: { status: "CANCELLED", lockedAt: null },
                    });
                }
                await tx.orderEvent.create({
                    data: {
                        orderId: id,
                        type: "status_changed",
                        message: `Order marked as ${nextStatus} (${source})`,
                    },
                });
                await tx.adminNotification.create({
                    data: {
                        type: "order_status",
                        title: `Order #${id.slice(-6).toUpperCase()} → ${nextStatus}`,
                        message: `Statut mis à jour (${source})`,
                        orderId: id,
                    },
                });
                return {
                    order: await tx.order.findUniqueOrThrow({
                        where: { id },
                        include: orderInclude,
                    }),
                    changed: true,
                };
            });
        } catch (error) {
            if ((error as { code?: string }).code === "P2034" && attempt < 4) {
                await new Promise((resolve) =>
                    setTimeout(resolve, 30 * 2 ** attempt + Math.random() * 30),
                );
                continue;
            }
            throw error;
        }
    }
    throw new AppError("Actualisez la commande et réessayez", 409);
}
