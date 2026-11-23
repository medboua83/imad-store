import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { canAdmin } from "@imad-store/shared";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";
import type { AuthRequest } from "../middleware/auth.middleware";
import { POS_MAX_CENTS, posIdentifier, posKey } from "./pos-core";
import { quotePos, normalizePosItems, posItemsSchema, posReceiptInclude } from "./pos";
import { lockCashier, cashSessionForSale, cashSessionDTO } from "./pos-cash";
type Actor = NonNullable<AuthRequest["user"]>;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
export const returnQuoteSchema = z
  .object({
    sourceKind: z.enum(["SALE", "EXCHANGE"]),
    sourceId: posIdentifier,
    returns: z
      .array(
        z
          .object({
            itemId: posIdentifier,
            quantity: z.number().int().min(1).max(1000),
            restock: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    replacements: posItemsSchema.or(z.tuple([])).optional().default([]),
  })
  .strict();
export const returnBodySchema = returnQuoteSchema
  .extend({
    quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
    cashSessionId: posIdentifier,
    paymentMethod: z.enum(["CASH", "CARD_TERMINAL", "NONE"]),
    receivedCents: z.number().int().min(0).max(POS_MAX_CENTS),
    note: z
      .string()
      .trim()
      .max(500)
      .refine((s) => [...s].length >= 3),
  })
  .strict();
export const adjustmentInclude = { items: { orderBy: { position: "asc" as const } } };
function normalized(b: z.infer<typeof returnQuoteSchema>) {
  if (new Set(b.returns.map((r) => r.itemId)).size !== b.returns.length)
    throw new AppError("Un article apparaît plusieurs fois dans le retour.", 400);
  return {
    ...b,
    returns: [...b.returns].sort((a, b) => a.itemId.localeCompare(b.itemId)),
    replacements: normalizePosItems(b.replacements),
  };
}
const money = (n: number) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > POS_MAX_CENTS)
    throw new AppError("Montant incompatible avec la caisse.", 409);
  return n;
};
export async function returnSource(
  tx: Prisma.TransactionClient,
  actor: Actor,
  kind: "SALE" | "EXCHANGE",
  id: string,
) {
  const scope = canAdmin(actor, "pos.read") ? {} : { cashierId: actor.id };
  const source =
    kind === "SALE"
      ? await tx.posSale.findFirst({ where: { id, ...scope }, include: posReceiptInclude })
      : await tx.posAdjustment.findFirst({ where: { id, ...scope }, include: adjustmentInclude });
  if (!source) throw new AppError("Ticket introuvable ou non autorisé.", 404);
  const rootSaleId = "rootSaleId" in source ? source.rootSaleId : source.id;
  const lines = source.items.filter((i) => !("kind" in i) || i.kind === "REPLACEMENT");
  const used = await tx.posAdjustmentItem.groupBy({
    by: ["sourceItemId"],
    where: {
      kind: "RETURN",
      adjustment: kind === "SALE" ? { sourceSaleId: id } : { sourceAdjustmentId: id },
    },
    _sum: { quantity: true, totalCents: true },
  });
  const variants = await tx.productVariant.findMany({
    where: { id: { in: lines.map((i) => i.variantId) } },
  });
  return {
    id,
    kind,
    rootSaleId,
    reference: (kind === "SALE" ? "POS-" : "RET-") + id.toUpperCase(),
    items: lines.map((i) => {
      const old = used.find((u) => u.sourceItemId === i.id),
        v = variants.find((v) => v.id === i.variantId);
      // Identifiers alone are insufficient after a variant is reused or edited.
      const canRestock =
        !!v &&
        v.productId === i.productId &&
        v.sku === i.sku &&
        v.size === i.size &&
        v.colorNameFr === i.colorFr &&
        v.colorNameAr === i.colorAr;
      return {
        ...i,
        returnedQuantity: old?._sum.quantity ?? 0,
        refundedCents: old?._sum.totalCents ?? 0,
        remainingQuantity: i.quantity - (old?._sum.quantity ?? 0),
        canRestock,
      };
    }),
  };
}
export async function quoteReturn(tx: Prisma.TransactionClient, actor: Actor, raw: unknown) {
  const b = normalized(returnQuoteSchema.parse(raw));
  const source = await returnSource(tx, actor, b.sourceKind, b.sourceId);
  const credits = new Map<string, number>();
  const lines = b.returns.map((r) => {
    const i = source.items.find((i) => i.id === r.itemId);
    if (!i || r.quantity > i.remainingQuantity)
      throw new AppError(
        "Quantité déjà retournée ou supérieure au ticket. Relisez le ticket.",
        409,
      );
    if (r.restock && !i.canRestock)
      throw new AppError(
        "Cette variante a changé ou n’existe plus. La remise en stock est impossible.",
        409,
      );
    // Cumulative pro-rata allocation preserves every cent, including partial promotional lots.
    const totalCents =
      Number(
        (BigInt(i.totalCents) * BigInt(i.returnedQuantity + r.quantity)) / BigInt(i.quantity),
      ) - i.refundedCents;
    if (r.restock) credits.set(i.variantId, (credits.get(i.variantId) ?? 0) + r.quantity);
    const { productId, variantId, sku, nameFr, nameAr, colorFr, colorAr, size, unitPriceCents } = i;
    return {
      productId,
      variantId,
      sku,
      nameFr,
      nameAr,
      colorFr,
      colorAr,
      size,
      unitPriceCents,
      sourceItemId: i.id,
      quantity: r.quantity,
      restock: r.restock,
      totalCents: money(totalCents),
    };
  });
  const replacement = b.replacements.length
    ? await quotePos(tx, b.replacements, credits)
    : { totalCents: 0, lines: [] };
  const returnCents = money(lines.reduce((n, i) => n + i.totalCents, 0)),
    replacementCents = replacement.totalCents;
  const value = {
    currency: "MAD" as const,
    sourceKind: b.sourceKind,
    sourceId: b.sourceId,
    rootSaleId: source.rootSaleId,
    returnCents,
    replacementCents,
    netCents: replacementCents - returnCents,
    returns: lines,
    replacements: replacement.lines,
  };
  return {
    ...value,
    quoteHash: hash({
      ...value,
      used: source.items.map((i) => [i.id, i.returnedQuantity, i.refundedCents]),
    }),
  };
}
export function visibleAdjustment(
  a: Prisma.PosAdjustmentGetPayload<{ include: typeof adjustmentInclude }>,
) {
  const { idempotencyKey: _, requestFingerprint: __, ...rest } = a;
  return { ...rest, reference: "RET-" + a.id.toUpperCase(), currency: "MAD" as const };
}
export async function completeReturn(actor: Actor, key: string, raw: unknown) {
  posKey.parse(key);
  const parsed = returnBodySchema.parse(raw),
    b = { ...parsed, ...normalized(parsed) },
    fingerprint = hash(b);
  for (let attempt = 0; attempt < 5; attempt++)
    try {
      return await prisma.$transaction(
        async (tx) => {
          await lockCashier(tx, actor.id);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"imad-pos-return:" + key},0))`;
          const u = await tx.user.findUnique({ where: { id: actor.id } });
          if (
            !u?.isActive ||
            u.mustSetPassword ||
            u.authVersion !== actor.authVersion ||
            !canAdmin(u, "pos.sell") ||
            !canAdmin(u, "pos.returns")
          )
            throw new AppError("Accès aux retours non autorisé. Reconnectez-vous.", 403);
          const old = await tx.posAdjustment.findUnique({
            where: { idempotencyKey: key },
            include: adjustmentInclude,
          });
          if (old) {
            if (old.cashierId !== actor.id || old.requestFingerprint !== fingerprint)
              throw new AppError("Cette référence de retour est déjà utilisée.", 409);
            return { data: visibleAdjustment(old), replay: true };
          }
          const sessionId = await cashSessionForSale(tx, actor.id, b.cashSessionId);
          if (!sessionId) throw new AppError("Ouvrez votre caisse avant un retour.", 409);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"imad-pos-return-source:" + b.sourceKind + ":" + b.sourceId},0))`;
          const source = await returnSource(tx, u, b.sourceKind, b.sourceId);
          const variantIds = [
            ...new Set([
              ...source.items.map((i) => i.variantId),
              ...b.replacements.map((i) => i.variantId),
            ]),
          ].sort();
          const found = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { productId: true },
          });
          const productIds = [...new Set(found.map((v) => v.productId))].sort();
          if (productIds.length)
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM "products" WHERE id IN (${Prisma.join(productIds)}) ORDER BY id FOR UPDATE`,
            );
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "product_variants" WHERE id IN (${Prisma.join(variantIds)}) ORDER BY id FOR UPDATE`,
          );
          const q = await quoteReturn(tx, u, {
            sourceKind: b.sourceKind,
            sourceId: b.sourceId,
            returns: b.returns,
            replacements: b.replacements,
          });
          if (q.quoteHash !== b.quoteHash)
            throw new AppError(
              "Le retour, les prix ou le stock ont changé. Vérifiez à nouveau.",
              409,
            );
          if (
            q.netCents < 0
              ? b.paymentMethod !== "CASH" || b.receivedCents !== 0
              : q.netCents === 0
                ? b.paymentMethod !== "NONE" || b.receivedCents !== 0
                : b.paymentMethod === "NONE" ||
                  b.receivedCents < q.netCents ||
                  (b.paymentMethod === "CARD_TERMINAL" && b.receivedCents !== q.netCents)
          )
            throw new AppError("Vérifiez la différence à encaisser ou à rembourser.", 400);
          const s = await tx.posCashSession.findUniqueOrThrow({
              where: { id: sessionId },
              include: { closing: true },
            }),
            balance = await cashSessionDTO(tx, s);
          if (b.paymentMethod === "CASH" && balance.expectedCents + q.netCents < 0)
            throw new AppError(
              "Espèces insuffisantes dans votre caisse pour ce remboursement.",
              409,
            );
          for (const i of q.returns)
            if (i.restock)
              await tx.productVariant.update({
                where: { id: i.variantId },
                data: { stock: { increment: i.quantity } },
              });
          for (const i of b.replacements) {
            const changed = await tx.productVariant.updateMany({
              where: { id: i.variantId, stock: { gte: i.quantity } },
              data: { stock: { decrement: i.quantity } },
            });
            if (changed.count !== 1) throw new AppError("Stock insuffisant pour l’échange.", 409);
          }
          const data = await tx.posAdjustment.create({
            data: {
              idempotencyKey: key,
              requestFingerprint: fingerprint,
              rootSaleId: q.rootSaleId,
              sourceSaleId: b.sourceKind === "SALE" ? b.sourceId : null,
              sourceAdjustmentId: b.sourceKind === "EXCHANGE" ? b.sourceId : null,
              cashierId: u.id,
              cashierName: [u.firstName, u.lastName].filter(Boolean).join(" "),
              cashSessionId: sessionId,
              returnCents: q.returnCents,
              replacementCents: q.replacementCents,
              netCents: q.netCents,
              paymentMethod: b.paymentMethod,
              receivedCents: b.receivedCents,
              changeCents: q.netCents > 0 ? b.receivedCents - q.netCents : 0,
              note: b.note,
              items: {
                create: [
                  ...q.returns.map((i) => ({ ...i, kind: "RETURN" })),
                  ...q.replacements.map((i) => ({
                    ...i,
                    sourceItemId: null,
                    restock: null,
                    kind: "REPLACEMENT",
                  })),
                ].map((i, position) => ({ ...i, position })),
              },
            },
            include: adjustmentInclude,
          });
          return { data: visibleAdjustment(data), replay: false };
        },
        { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 20000 },
      );
    } catch (e) {
      if (["P2034", "P2002"].includes((e as { code?: string }).code ?? "") && attempt < 4) continue;
      throw e;
    }
  throw new AppError("Retour non confirmé. Vérifiez son état avant de réessayer.", 409);
}
