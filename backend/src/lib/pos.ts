import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { canAdmin, isAmbiguousSize, priceCart, productVariantImages } from "@imad-store/shared";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";
import type { AuthRequest } from "../middleware/auth.middleware";
import { POS_MAX_CENTS, posIdentifier as identifier } from "./pos-core";
import { cashSessionForSale, lockCashier } from "./pos-cash";
export { POS_MAX_CENTS, posKey } from "./pos-core";
export const posItemsSchema = z
  .array(z.object({ variantId: identifier, quantity: z.number().int().min(1).max(1000) }).strict())
  .min(1)
  .max(100);
export const posSaleSchema = z
  .object({
    items: posItemsSchema,
    quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
    paymentMethod: z.enum(["CASH", "CARD_TERMINAL"]),
    receivedCents: z.number().int().min(0).max(POS_MAX_CENTS),
    cashSessionId: identifier.optional(),
  })
  .strict();
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function normalizePosItems(items: z.infer<typeof posItemsSchema>) {
  const rows = new Map<string, number>();
  for (const item of items)
    rows.set(item.variantId, (rows.get(item.variantId) ?? 0) + item.quantity);
  if ([...rows.values()].some((quantity) => quantity > 1000))
    throw new AppError("Quantité trop élevée pour cette variante.", 400);
  return [...rows]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}
const cents = (amount: number) => {
  const value = Math.round(amount * 100);
  if (!Number.isSafeInteger(value) || value < 0 || value > POS_MAX_CENTS)
    throw new AppError("Montant incompatible avec la caisse.", 409);
  return value;
};
export async function quotePos(
  tx: Prisma.TransactionClient,
  requested: z.infer<typeof posItemsSchema>,
) {
  const items = normalizePosItems(requested);
  const variants = await tx.productVariant.findMany({
    where: { id: { in: items.map((item) => item.variantId) } },
    include: { product: true },
  });
  const input = items.map((item) => {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant || variant.product.status !== "ACTIVE" || isAmbiguousSize(variant.size))
      throw new AppError("Un article n’est plus disponible. Retirez-le du panier.", 409);
    if (variant.stock < item.quantity)
      throw new AppError("Stock insuffisant. Modifiez les quantités ou retirez l’article.", 409);
    return {
      ...item,
      productId: variant.productId,
      price: variant.product.price,
      quantityDiscounts: variant.product.quantityDiscounts,
      variant,
    };
  });
  const priced = priceCart(input);
  const lines = priced.lines.map(({ item, total }) => ({
    productId: item.productId,
    variantId: item.variantId,
    sku: item.variant.sku,
    nameFr: item.variant.product.nameFr,
    nameAr: item.variant.product.nameAr,
    colorFr: item.variant.colorNameFr,
    colorAr: item.variant.colorNameAr,
    size: item.variant.size,
    quantity: item.quantity,
    unitPriceCents: cents(item.price),
    totalCents: cents(total),
  }));
  const totalCents = cents(priced.subtotal),
    savingsCents = cents(priced.savings);
  return {
    currency: "MAD" as const,
    totalCents,
    savingsCents,
    lines,
    quoteHash: hash({ lines, totalCents, savingsCents }),
  };
}
export const posReceiptInclude = { items: { orderBy: { position: "asc" as const } } };
export async function completePosSale(
  actor: NonNullable<AuthRequest["user"]>,
  key: string,
  raw: unknown,
) {
  const body = posSaleSchema.parse(raw),
    items = normalizePosItems(body.items);
  const fingerprint = hash({ ...body, items });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await lockCashier(tx, actor.id);
          // Serializes all retries of the same attempt before checking prices or stock.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"imad-pos:" + key}, 0))`;
          const cashier = await tx.user.findUnique({ where: { id: actor.id } });
          if (
            !cashier?.isActive ||
            cashier.mustSetPassword ||
            cashier.authVersion !== actor.authVersion ||
            !canAdmin(cashier, "pos.sell")
          )
            throw new AppError("Accès caisse non autorisé. Reconnectez-vous.", 403);
          const previous = await tx.posSale.findUnique({
            where: { idempotencyKey: key },
            include: posReceiptInclude,
          });
          if (previous) {
            if (previous.cashierId !== actor.id || previous.requestFingerprint !== fingerprint)
              throw new AppError("Cette référence d’encaissement est déjà utilisée.", 409);
            return { sale: previous, replay: true };
          }
          const cashSessionId = await cashSessionForSale(tx, actor.id, body.cashSessionId);
          // Freeze product prices and variants through settlement. Website checkout still uses its CAS stock reservation.
          const found = await tx.productVariant.findMany({
            where: { id: { in: items.map((i) => i.variantId) } },
            select: { productId: true },
          });
          if (found.length !== items.length)
            throw new AppError("Un article n’est plus disponible. Retirez-le du panier.", 409);
          const productIds = [...new Set(found.map((v) => v.productId))].sort();
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "products" WHERE id IN (${Prisma.join(productIds)}) ORDER BY id FOR UPDATE`,
          );
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "product_variants" WHERE id IN (${Prisma.join(items.map((i) => i.variantId))}) ORDER BY id FOR UPDATE`,
          );
          const quote = await quotePos(tx, items);
          if (quote.quoteHash !== body.quoteHash)
            throw new AppError(
              "Les prix ou les articles ont changé. Vérifiez à nouveau le panier.",
              409,
            );
          if (
            body.receivedCents < quote.totalCents ||
            (body.paymentMethod === "CARD_TERMINAL" && body.receivedCents !== quote.totalCents)
          )
            throw new AppError("Vérifiez le montant encaissé.", 400);
          for (const item of items) {
            const reserved = await tx.productVariant.updateMany({
              where: { id: item.variantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (reserved.count !== 1)
              throw new AppError(
                "Stock insuffisant. Modifiez les quantités ou retirez l’article.",
                409,
              );
          }
          const sale = await tx.posSale.create({
            data: {
              idempotencyKey: key,
              requestFingerprint: fingerprint,
              cashierId: cashier.id,
              cashierName: [cashier.firstName, cashier.lastName].filter(Boolean).join(" "),
              paymentMethod: body.paymentMethod,
              cashSessionId,
              totalCents: quote.totalCents,
              savingsCents: quote.savingsCents,
              receivedCents: body.receivedCents,
              changeCents: body.receivedCents - quote.totalCents,
              items: { create: quote.lines.map((line, position) => ({ ...line, position })) },
            },
            include: posReceiptInclude,
          });
          // Deliberately no Order, CRM outbox, notification bridge or carrier job.
          return { sale, replay: false };
        },
        { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 20000 },
      );
    } catch (error) {
      if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "") && attempt < 4)
        continue;
      throw error;
    }
  }
  throw new AppError("Encaissement non confirmé. Vérifiez son état avant de réessayer.", 409);
}
export function visiblePosReceipt(sale: Awaited<ReturnType<typeof completePosSale>>["sale"]) {
  const { idempotencyKey: _key, requestFingerprint: _fingerprint, ...visible } = sale;
  return { ...visible, currency: "MAD" as const, reference: "POS-" + sale.id.toUpperCase() };
}
export function posCatalogRow(
  variant: Prisma.ProductVariantGetPayload<{ include: { product: true } }>,
) {
  const p = variant.product;
  const colorPhotos =
    z.array(z.object({ colorKey: z.string(), image: z.string() })).safeParse(p.colorPhotos).data ??
    [];
  return {
    id: variant.id,
    productId: p.id,
    sku: variant.sku,
    nameFr: p.nameFr,
    nameAr: p.nameAr,
    size: variant.size,
    colorFr: variant.colorNameFr,
    colorAr: variant.colorNameAr,
    stock: variant.stock,
    unitPriceCents: cents(p.price),
    image: productVariantImages({ images: p.images, colorPhotos }, variant)[0] ?? null,
  };
}
