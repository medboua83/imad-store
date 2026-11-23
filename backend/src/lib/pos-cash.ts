import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { canAdmin } from "@imad-store/shared";
import { prisma } from "./prisma";
import { POS_MAX_CENTS, posIdentifier } from "./pos-core";
import { AppError } from "../middleware/error.middleware";
import type { AuthRequest } from "../middleware/auth.middleware";
type Actor = NonNullable<AuthRequest["user"]>;
type Session = Prisma.PosCashSessionGetPayload<{ include: { closing: true } }>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const amount = z.number().int().min(0).max(POS_MAX_CENTS);
export const cashOpenSchema = z.object({ openingCents: amount }).strict();
export const cashCloseSchema = z
  .object({
    sessionId: posIdentifier,
    balanceHash: z.string().regex(/^[a-f0-9]{64}$/),
    countedCents: amount,
    note: z.string().trim().max(500).default(""),
  })
  .strict();
export const cashActionKey = (kind: "open" | "close") =>
  z.string().regex(new RegExp("^" + kind + "_[a-zA-Z0-9_-]{16,120}$"));
export async function lockCashier(tx: Prisma.TransactionClient, actorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"imad-pos-cashier:" + actorId}, 0))`;
}
export async function cashSessionForSale(
  tx: Prisma.TransactionClient,
  actorId: string,
  requested?: string,
) {
  const register = await tx.posCashRegister.findUnique({
    where: { cashierId: actorId },
    include: { activeSession: { include: { closing: true } } },
  });
  if (!register && !requested) return null;
  if (
    !register?.activeSession ||
    register.activeSession.cashierId !== actorId ||
    register.activeSession.closing ||
    register.activeSessionId !== requested
  )
    throw new AppError(
      "Votre session de caisse a changé. Vérifiez Ma caisse avant d’encaisser.",
      409,
    );
  return register.activeSessionId;
}
async function write<T>(
  actor: Actor,
  key: string,
  work: (
    tx: Prisma.TransactionClient,
    cashier: { id: string; firstName: string; lastName: string },
  ) => Promise<T>,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await lockCashier(tx, actor.id);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"imad-pos-cash-action:" + key}, 0))`;
          const u = await tx.user.findUnique({ where: { id: actor.id } });
          if (
            !u?.isActive ||
            u.mustSetPassword ||
            u.authVersion !== actor.authVersion ||
            !canAdmin(u, "pos.sell")
          )
            throw new AppError("Accès caisse non autorisé. Reconnectez-vous.", 403);
          return work(tx, u);
        },
        { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 20000 },
      );
    } catch (error) {
      if (["P2034", "P2002"].includes((error as { code?: string }).code ?? "") && attempt < 4)
        continue;
      throw error;
    }
  }
  throw new AppError("Opération de caisse non confirmée. Vérifiez son état.", 409);
}
const safe = (value: number | bigint) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new AppError("Montant incompatible avec la caisse.", 409);
  return n;
};
async function totals(tx: Prisma.TransactionClient, ids: string[]) {
  return tx.posSale.groupBy({
    by: ["cashSessionId", "paymentMethod"],
    where: { cashSessionId: { in: ids } },
    _count: true,
    _sum: { totalCents: true },
  });
}
type Totals = Awaited<ReturnType<typeof totals>>;
export async function cashSessionDTO(
  tx: Prisma.TransactionClient,
  session: Session,
  groups?: Totals,
) {
  const c = session.closing,
    rows = c ? [] : (groups ?? (await totals(tx, [session.id])));
  const cash = rows.find((r) => r.cashSessionId === session.id && r.paymentMethod === "CASH"),
    card = rows.find((r) => r.cashSessionId === session.id && r.paymentMethod === "CARD_TERMINAL");
  const cashCents = safe(c?.cashCents ?? cash?._sum.totalCents ?? 0),
    cardCents = safe(c?.cardCents ?? card?._sum.totalCents ?? 0);
  const cashCount = c?.cashCount ?? cash?._count ?? 0,
    cardCount = c?.cardCount ?? card?._count ?? 0;
  const expectedCents = safe(c?.expectedCents ?? session.openingCents + cashCents);
  return {
    id: session.id,
    reference: "CAISSE-" + session.id.toUpperCase(),
    currency: "MAD" as const,
    cashierId: session.cashierId,
    cashierName: session.cashierName,
    openingCents: session.openingCents,
    openedAt: session.openedAt.toISOString(),
    cashCents,
    cardCents,
    cashCount,
    cardCount,
    expectedCents,
    balanceHash: hash({
      id: session.id,
      openingCents: session.openingCents,
      cashCents,
      cardCents,
      cashCount,
      cardCount,
    }),
    closing: c
      ? {
          id: c.id,
          countedCents: c.countedCents,
          differenceCents: safe(c.differenceCents),
          note: c.note,
          closedAt: c.closedAt.toISOString(),
        }
      : null,
  };
}
export async function getCashState(actor: Actor) {
  return prisma.$transaction(
    async (tx) => {
      const register = await tx.posCashRegister.findUnique({
        where: { cashierId: actor.id },
        include: { activeSession: { include: { closing: true } } },
      });
      if (
        register?.activeSession &&
        (register.activeSession.cashierId !== actor.id || register.activeSession.closing)
      )
        throw new AppError("Session de caisse indisponible. Réessayez.", 409);
      return {
        enabled: !!register,
        active: register?.activeSession ? await cashSessionDTO(tx, register.activeSession) : null,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function openCashSession(actor: Actor, key: string, raw: unknown) {
  cashActionKey("open").parse(key);
  const body = cashOpenSchema.parse(raw),
    fingerprint = hash(body);
  return write(actor, key, async (tx, u) => {
    const old = await tx.posCashSession.findUnique({
      where: { openKey: key },
      include: { closing: true },
    });
    if (old) {
      if (old.cashierId !== actor.id || old.requestFingerprint !== fingerprint)
        throw new AppError("Cette référence de caisse est déjà utilisée.", 409);
      return { data: await cashSessionDTO(tx, old), replay: true };
    }
    const register = await tx.posCashRegister.findUnique({ where: { cashierId: actor.id } });
    if (register?.activeSessionId)
      throw new AppError("Une session de caisse est déjà ouverte.", 409);
    const session = await tx.posCashSession.create({
      data: {
        openKey: key,
        requestFingerprint: fingerprint,
        cashierId: u.id,
        cashierName: [u.firstName, u.lastName].filter(Boolean).join(" "),
        openingCents: body.openingCents,
      },
      include: { closing: true },
    });
    await tx.posCashRegister.upsert({
      where: { cashierId: actor.id },
      create: { cashierId: actor.id, activeSessionId: session.id },
      update: { activeSessionId: session.id },
    });
    return { data: await cashSessionDTO(tx, session), replay: false };
  });
}
export async function closeCashSession(actor: Actor, key: string, raw: unknown) {
  cashActionKey("close").parse(key);
  const body = cashCloseSchema.parse(raw),
    fingerprint = hash(body);
  return write(actor, key, async (tx) => {
    const old = await tx.posCashClosing.findUnique({
      where: { closeKey: key },
      include: { session: { include: { closing: true } } },
    });
    if (old) {
      if (old.session.cashierId !== actor.id || old.requestFingerprint !== fingerprint)
        throw new AppError("Cette référence de caisse est déjà utilisée.", 409);
      return { data: await cashSessionDTO(tx, old.session), replay: true };
    }
    const register = await tx.posCashRegister.findUnique({
        where: { cashierId: actor.id },
        include: { activeSession: { include: { closing: true } } },
      }),
      session = register?.activeSession;
    if (
      !session ||
      session.id !== body.sessionId ||
      session.cashierId !== actor.id ||
      session.closing
    )
      throw new AppError(
        "Votre session de caisse a changé. Vérifiez Ma caisse avant d’encaisser.",
        409,
      );
    const summary = await cashSessionDTO(tx, session);
    if (summary.balanceHash !== body.balanceHash)
      throw new AppError(
        "Des ventes ont été ajoutées. Recomptez la caisse avant de clôturer.",
        409,
      );
    const difference = safe(body.countedCents - summary.expectedCents);
    if (difference !== 0 && body.note.length < 3)
      throw new AppError("Expliquez l’écart de caisse avant de clôturer.", 400);
    await tx.posCashClosing.create({
      data: {
        sessionId: session.id,
        closeKey: key,
        requestFingerprint: fingerprint,
        countedCents: body.countedCents,
        cashCents: BigInt(summary.cashCents),
        cardCents: BigInt(summary.cardCents),
        cashCount: summary.cashCount,
        cardCount: summary.cardCount,
        expectedCents: BigInt(summary.expectedCents),
        differenceCents: BigInt(difference),
        note: body.note,
      },
    });
    await tx.posCashRegister.update({
      where: { cashierId: actor.id },
      data: { activeSessionId: null },
    });
    return {
      data: await cashSessionDTO(
        tx,
        await tx.posCashSession.findUniqueOrThrow({
          where: { id: session.id },
          include: { closing: true },
        }),
      ),
      replay: false,
    };
  });
}
export async function recoverCashAction(actor: Actor, key: string) {
  const opening = key.startsWith("open_");
  cashActionKey(opening ? "open" : "close").parse(key);
  return prisma.$transaction(
    async (tx) => {
      const session = opening
        ? await tx.posCashSession.findFirst({
            where: { openKey: key, cashierId: actor.id },
            include: { closing: true },
          })
        : (
            await tx.posCashClosing.findFirst({
              where: { closeKey: key, session: { cashierId: actor.id } },
              include: { session: { include: { closing: true } } },
            })
          )?.session;
      if (!session)
        throw new AppError("Cette opération de caisse n’est pas encore enregistrée.", 404);
      return { kind: opening ? "open" : "close", data: await cashSessionDTO(tx, session) };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function readCashSession(actor: Actor, id: string) {
  posIdentifier.parse(id);
  return prisma.$transaction(
    async (tx) => {
      const session = await tx.posCashSession.findFirst({
        where: { id, ...(canAdmin(actor, "pos.read") ? {} : { cashierId: actor.id }) },
        include: { closing: true },
      });
      if (!session) throw new AppError("Session de caisse introuvable.", 404);
      return cashSessionDTO(tx, session);
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function listCashSessions(actor: Actor, query: unknown) {
  const q = z
    .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
    .strict()
    .parse(query);
  return prisma.$transaction(
    async (tx) => {
      const all = canAdmin(actor, "pos.read"),
        where = all ? {} : { cashierId: actor.id };
      const total = await tx.posCashSession.count({ where }),
        totalPages = Math.ceil(total / 25),
        page = Math.min(q.page, Math.max(1, totalPages));
      const rows = await tx.posCashSession.findMany({
        where,
        orderBy: [{ openedAt: "desc" }, { id: "desc" }],
        take: 25,
        skip: (page - 1) * 25,
        include: { closing: true },
      });
      const groups = await totals(
        tx,
        rows.filter((s) => !s.closing).map((s) => s.id),
      );
      return {
        data: await Promise.all(rows.map((s) => cashSessionDTO(tx, s, groups))),
        page,
        totalPages,
        total,
        scope: all ? "ALL" : "OWN",
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
