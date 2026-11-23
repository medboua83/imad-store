import { Response } from "express";
import { z } from "zod";
import { canAdmin } from "@imad-store/shared";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { posIdentifier, posKey } from "../lib/pos-core";
import { AppError } from "../middleware/error.middleware";
import {
  completeReturn,
  quoteReturn,
  returnSource,
  visibleAdjustment,
  adjustmentInclude,
} from "../lib/pos-returns";
export async function source(req: AuthRequest, res: Response) {
  const { kind, id } = z
    .object({ kind: z.enum(["SALE", "EXCHANGE"]), id: posIdentifier })
    .strict()
    .parse(req.query);
  res.json({
    success: true,
    data: await prisma.$transaction((tx) => returnSource(tx, req.user!, kind, id), {
      isolationLevel: "RepeatableRead",
    }),
  });
}
export async function quote(req: AuthRequest, res: Response) {
  res.json({
    success: true,
    data: await prisma.$transaction((tx) => quoteReturn(tx, req.user!, req.body), {
      isolationLevel: "RepeatableRead",
    }),
  });
}
export async function complete(req: AuthRequest, res: Response) {
  const r = await completeReturn(req.user!, posKey.parse(req.header("Idempotency-Key")), req.body);
  res.status(r.replay ? 200 : 201).json({ success: true, ...r });
}
export async function recover(req: AuthRequest, res: Response) {
  const a = await prisma.posAdjustment.findFirst({
    where: { idempotencyKey: posKey.parse(req.params.key), cashierId: req.user!.id },
    include: adjustmentInclude,
  });
  if (!a) throw new AppError("Ce retour n’est pas encore enregistré.", 404);
  res.json({ success: true, data: visibleAdjustment(a) });
}
export async function read(req: AuthRequest, res: Response) {
  const a = await prisma.posAdjustment.findFirst({
    where: {
      id: posIdentifier.parse(req.params.id),
      ...(canAdmin(req.user!, "pos.read") ? {} : { cashierId: req.user!.id }),
    },
    include: adjustmentInclude,
  });
  if (!a) throw new AppError("Reçu de retour introuvable.", 404);
  res.json({ success: true, data: visibleAdjustment(a) });
}
export async function history(req: AuthRequest, res: Response) {
  const { page: requested } = z
    .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
    .strict()
    .parse(req.query);
  const result = await prisma.$transaction(
    async (tx) => {
      const where = canAdmin(req.user!, "pos.read") ? {} : { cashierId: req.user!.id };
      const total = await tx.posAdjustment.count({ where }),
        totalPages = Math.ceil(total / 25),
        page = Math.min(requested, Math.max(1, totalPages));
      const data = await tx.posAdjustment.findMany({
        where,
        take: 25,
        skip: (page - 1) * 25,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: adjustmentInclude,
      });
      return { data: data.map(visibleAdjustment), total, totalPages, page };
    },
    { isolationLevel: "RepeatableRead" },
  );
  res.json({ success: true, ...result });
}
