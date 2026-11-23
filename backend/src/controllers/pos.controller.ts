import { Response } from "express";
import { z } from "zod";
import { canAdmin, isAmbiguousSize } from "@imad-store/shared";
import { Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { prisma } from "../lib/prisma";
import {
  completePosSale,
  posItemsSchema,
  quotePos,
  posKey,
  posReceiptInclude,
  posCatalogRow,
  visiblePosReceipt,
} from "../lib/pos";
import { moroccoDayBoundary } from "../lib/order-history-query";
export async function posContext(req: AuthRequest, res: Response) {
  res.json({
    success: true,
    data: {
      actorId: req.user!.id,
      canSell: canAdmin(req.user!, "pos.sell"),
      canReturn: canAdmin(req.user!, "pos.sell") && canAdmin(req.user!, "pos.returns"),
      canReadAll: canAdmin(req.user!, "pos.read"),
    },
  });
}
export async function posCatalog(req: AuthRequest, res: Response) {
  const q = z
    .object({
      search: z.string().trim().max(120).default(""),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    })
    .strict()
    .parse(req.query);
  const product = { status: "ACTIVE" as const };
  const search = q.search
    ? {
        OR: [
          { sku: { contains: q.search, mode: "insensitive" as const } },
          { product: { nameFr: { contains: q.search, mode: "insensitive" as const } } },
          { product: { nameAr: { contains: q.search, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const result = await prisma.$transaction(
    async (tx) => {
      const where = { product, ...search };
      const total = await tx.productVariant.count({ where }),
        totalPages = Math.ceil(total / 24),
        page = Math.min(q.page, Math.max(1, totalPages));
      const rows = await tx.productVariant.findMany({
        where,
        include: { product: true },
        orderBy: [{ productId: "asc" }, { id: "asc" }],
        take: 24,
        skip: (page - 1) * 24,
      });
      return {
        data: rows.map((v) => ({
          ...posCatalogRow(v),
          available: v.stock > 0 && !isAmbiguousSize(v.size),
        })),
        total,
        page,
        totalPages,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
  res.json({ success: true, ...result });
}
/** A scanned reference is looked up globally, never within a catalogue page. */
export async function posScan(req: AuthRequest, res: Response) {
  const { sku } = z
    .object({ sku: z.string().trim().min(1).max(100) })
    .strict()
    .parse(req.query);
  const variant = await prisma.productVariant.findUnique({
    where: { sku },
    include: { product: true },
  });
  if (!variant || variant.product.status !== "ACTIVE")
    throw new AppError("Référence introuvable.", 404);
  res.json({
    success: true,
    data: {
      ...posCatalogRow(variant),
      available: variant.stock > 0 && !isAmbiguousSize(variant.size),
    },
  });
}
export async function posQuote(req: AuthRequest, res: Response) {
  const { items } = z.object({ items: posItemsSchema }).strict().parse(req.body);
  const quote = await prisma.$transaction((tx) => quotePos(tx, items), {
    isolationLevel: "RepeatableRead",
  });
  res.json({ success: true, data: quote });
}
export async function posComplete(req: AuthRequest, res: Response) {
  const key = posKey.parse(req.header("Idempotency-Key"));
  const result = await completePosSale(req.user!, key, req.body);
  res
    .status(result.replay ? 200 : 201)
    .json({ success: true, data: visiblePosReceipt(result.sale), idempotentReplay: result.replay });
}
export async function posRecover(req: AuthRequest, res: Response) {
  const key = posKey.parse(req.params.key);
  const sale = await prisma.posSale.findFirst({
    where: { idempotencyKey: key, cashierId: req.user!.id },
    include: posReceiptInclude,
  });
  if (!sale) throw new AppError("Cet encaissement n’est pas encore enregistré.", 404);
  res.json({ success: true, data: visiblePosReceipt(sale) });
}
export async function posReceipt(req: AuthRequest, res: Response) {
  const id = z
    .string()
    .regex(/^[a-f0-9]{24}$/)
    .parse(req.params.id);
  const sale = await prisma.posSale.findFirst({
    where: { id, ...(canAdmin(req.user!, "pos.read") ? {} : { cashierId: req.user!.id }) },
    include: posReceiptInclude,
  });
  if (!sale) throw new AppError("Ticket introuvable.", 404);
  res.json({ success: true, data: visiblePosReceipt(sale) });
}
export async function posHistory(req: AuthRequest, res: Response) {
  const calendarDay = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(value + "T00:00:00Z");
      return (
        !value.startsWith("0000") &&
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Date invalide");
  const q = z
    .object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
      search: z.string().trim().max(32).default(""),
      from: calendarDay.optional(),
      to: calendarDay.optional(),
      paymentMethod: z.enum(["CASH", "CARD_TERMINAL"]).optional(),
      cashierId: z
        .string()
        .regex(/^[a-f0-9]{24}$/)
        .optional(),
    })
    .strict()
    .refine((q) => !q.from || !q.to || q.from <= q.to, "Période invalide")
    .parse(req.query);
  const all = canAdmin(req.user!, "pos.read"),
    actor = req.user!.id;
  if (!all && q.cashierId && q.cashierId !== actor)
    throw new AppError("Consultez uniquement vos ventes en caisse.", 403);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  const result = await prisma.$transaction(
    async (tx) => {
      const cashierId = all ? q.cashierId : actor;
      const reference = q.search.replace(/^#/, "").replace(/^POS-/i, "").toLowerCase();
      const where: Prisma.PosSaleWhereInput = {
        ...(cashierId ? { cashierId } : {}),
        ...(q.paymentMethod ? { paymentMethod: q.paymentMethod } : {}),
        ...(q.from || q.to
          ? {
              createdAt: {
                ...(q.from
                  ? { gte: new Date(moroccoDayBoundary(q.from).replace(" ", "T") + "Z") }
                  : {}),
                ...(q.to
                  ? { lt: new Date(moroccoDayBoundary(q.to, true).replace(" ", "T") + "Z") }
                  : {}),
              },
            }
          : {}),
        ...(reference
          ? { id: { contains: /^[a-f0-9]+$/.test(reference) ? reference : "invalid-reference" } }
          : {}),
      };
      const total = await tx.posSale.count({ where }),
        totalPages = Math.ceil(total / 25),
        page = Math.min(q.page, Math.max(1, totalPages));
      const rows = await tx.posSale.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 25,
        skip: (page - 1) * 25,
        select: {
          id: true,
          cashierId: true,
          cashierName: true,
          paymentMethod: true,
          totalCents: true,
          createdAt: true,
        },
      });
      const today = await tx.posSale.aggregate({
        where: {
          AND: [
            where,
            {
              createdAt: {
                gte: new Date(moroccoDayBoundary(day).replace(" ", "T") + "Z"),
                lt: new Date(moroccoDayBoundary(day, true).replace(" ", "T") + "Z"),
              },
            },
          ],
        },
        _count: true,
        _sum: { totalCents: true },
      });
      const cashiers = await tx.$queryRaw<{ id: string; name: string }[]>(
        Prisma.sql`SELECT DISTINCT ON ("cashierId") "cashierId" AS id, "cashierName" AS name FROM "pos_sales" ${all ? Prisma.empty : Prisma.sql`WHERE "cashierId" = ${actor}`} ORDER BY "cashierId", "createdAt" DESC, "pos_sales"."id" DESC`,
      );
      return {
        data: rows,
        total,
        page,
        totalPages,
        cashiers,
        scope: all ? "ALL" : "OWN",
        today: { count: today._count, totalCents: today._sum.totalCents ?? 0 },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
  res.json({ success: true, ...result, currency: "MAD" });
}
