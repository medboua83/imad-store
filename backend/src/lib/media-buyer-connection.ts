import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "./prisma";
import { AppError } from "../middleware/error.middleware";
import { lockTeam } from "./team-access";
import { currentMfaAccount, consumeMfa, factorResult } from "./admin-mfa";
import { encryptDeskcommValue, decryptDeskcommValue } from "./deskcomm-config";
import {
  metaAccountId,
  mediaDay,
  mediaDays,
  mediaToday,
  readMetaAccount,
  verifyMetaInsights,
  readMetaSpend,
  MetaReadError,
} from "./meta-ads";
import type { MediaConnection } from "@imad-store/shared";

type Actor = NonNullable<AuthRequest["user"]>;
export const mediaCredentials = {
  currentPassword: z.string().min(1).max(128),
  code: z.string().trim().min(1).max(80).optional(),
  revision: z.number().int().min(0),
};
const token = z.string().regex(/^[A-Za-z0-9_.|~+\/=-]{20,4096}$/);
export const mediaConnectSchema = z
  .object({
    ...mediaCredentials,
    accountId: metaAccountId,
    token: z.union([token, z.literal("")]).default(""),
  })
  .strict();
export const mediaDisconnectSchema = z.object(mediaCredentials).strict();
export const mediaTargetSchema = z
  .object({
    revision: z.number().int().min(0),
    targetCents: z.number().int().min(1).max(100000000).nullable(),
  })
  .strict();
export const mediaSyncSchema = z
  .object({ from: mediaDay, to: mediaDay, revision: z.number().int().min(1) })
  .strict();
const changed = () =>
  new AppError("Les réglages Media Buyer ont changé. Actualisez le module.", 409);
function openToken(accountId: string, ciphertext: string) {
  try {
    const value = JSON.parse(decryptDeskcommValue(ciphertext));
    if (value.version !== 1 || value.accountId !== accountId) throw new Error();
    return token.parse(value.token);
  } catch {
    throw new AppError("Le jeton Meta doit être reconfiguré.", 409);
  }
}
export async function mediaConnection(actor: Actor): Promise<MediaConnection> {
  const [row, mfa] = await Promise.all([
    prisma.mediaBuyerConnection.findUnique({ where: { id: "meta" } }),
    prisma.adminMfa.findUnique({ where: { userId: actor.id }, select: { enabledAt: true } }),
  ]);
  const timeZone = row?.timeZone ?? "Africa/Casablanca";
  return {
    revision: row?.revision ?? 0,
    connected: !!row?.tokenCiphertext,
    accountId: row?.accountId ?? null,
    accountName: row?.accountName ?? null,
    currency: row?.currency ?? null,
    timeZone,
    today: mediaToday(timeZone),
    targetCents: row?.targetCents ?? null,
    lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    syncing: !!row?.syncLease && !!row.syncLockedUntil && row.syncLockedUntil > new Date(),
    mfaEnabled: !!mfa?.enabledAt,
    canManage: actor.role === "ADMIN",
  };
}
async function proveManager(actor: Actor, input: z.infer<typeof mediaDisconnectSchema>) {
  const factor = await prisma.$transaction(
    async (tx) => {
      await lockTeam(tx, actor);
      await currentMfaAccount(tx, actor, input.currentPassword);
      const current = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
      if ((current?.revision ?? 0) !== input.revision) throw changed();
      const state = await tx.adminMfa.findUnique({ where: { userId: actor.id } });
      if (!state?.enabledAt) return "ok" as const;
      if (!input.code)
        throw new AppError("Saisissez le code de l’application ou un code de secours.", 400);
      return consumeMfa(tx, state, input.code);
    },
    { isolationLevel: "ReadCommitted" },
  );
  factorResult(factor);
}
export async function connectMeta(actor: Actor, raw: unknown) {
  const input = mediaConnectSchema.parse(raw);
  await proveManager(actor, input);
  const old = await prisma.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
  if ((old?.revision ?? 0) !== input.revision) throw changed();
  const credential =
    input.token ||
    (old?.accountId === input.accountId && old.tokenCiphertext
      ? openToken(input.accountId, old.tokenCiphertext)
      : null);
  if (!credential) throw new AppError("Renseignez un jeton Meta pour ce compte publicitaire.", 400);
  const deadline = Date.now() + 30000,
    account = await readMetaAccount(input.accountId, credential, deadline);
  await verifyMetaInsights(input.accountId, credential, account.timeZone, deadline);
  const ciphertext = encryptDeskcommValue(
    JSON.stringify({ version: 1, accountId: input.accountId, token: credential }),
  );
  await prisma.$transaction(
    async (tx) => {
      await lockTeam(tx, actor);
      const current = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
      if ((current?.revision ?? 0) !== input.revision) throw changed();
      const sameAccount =
        current?.accountId === account.accountId &&
        current.currency === account.currency &&
        current.timeZone === account.timeZone;
      const data = {
        ...account,
        tokenCiphertext: ciphertext,
        lastError: null,
        syncLease: null,
        syncLockedUntil: null,
        lastSyncAt: sameAccount ? current.lastSyncAt : null,
      };
      await tx.mediaBuyerConnection.upsert({
        where: { id: "meta" },
        create: { id: "meta", ...data },
        update: { ...data, revision: { increment: 1 } },
      });
      await tx.accessEvent.create({ data: { actorId: actor.id, action: "MEDIA_BUYER_CONNECTED" } });
    },
    { isolationLevel: "ReadCommitted" },
  );
  return mediaConnection(actor);
}
export async function disconnectMeta(actor: Actor, raw: unknown) {
  const input = mediaDisconnectSchema.parse(raw);
  await proveManager(actor, input);
  await prisma.$transaction(
    async (tx) => {
      await lockTeam(tx, actor);
      const row = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
      if (!row || row.revision !== input.revision) throw changed();
      // Cached figures remain readable; the credential and any in-flight write lease are removed.
      await tx.mediaBuyerConnection.update({
        where: { id: "meta" },
        data: {
          tokenCiphertext: null,
          syncLease: null,
          syncLockedUntil: null,
          lastError: null,
          revision: { increment: 1 },
        },
      });
      await tx.accessEvent.create({
        data: { actorId: actor.id, action: "MEDIA_BUYER_DISCONNECTED" },
      });
    },
    { isolationLevel: "ReadCommitted" },
  );
  return mediaConnection(actor);
}
export async function setMediaTarget(actor: Actor, raw: unknown) {
  const input = mediaTargetSchema.parse(raw);
  await prisma.$transaction(
    async (tx) => {
      await lockTeam(tx, actor);
      const row = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
      if ((row?.revision ?? 0) !== input.revision) throw changed();
      await tx.mediaBuyerConnection.upsert({
        where: { id: "meta" },
        create: { id: "meta", targetCents: input.targetCents },
        update: {
          targetCents: input.targetCents,
          revision: { increment: 1 },
          syncLease: null,
          syncLockedUntil: null,
        },
      });
      await tx.accessEvent.create({
        data: { actorId: actor.id, action: "MEDIA_BUYER_TARGET_UPDATED" },
      });
    },
    { isolationLevel: "ReadCommitted" },
  );
  return mediaConnection(actor);
}
export async function syncMetaSpend(actor: Actor, raw: unknown) {
  const input = mediaSyncSchema.parse(raw),
    days = mediaDays(input.from, input.to),
    lease = randomUUID();
  const row = await prisma.$transaction(
    async (tx) => {
      await lockTeam(tx, actor);
      const cfg = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
      if (!cfg?.accountId || !cfg.tokenCiphertext || !cfg.currency || !cfg.timeZone)
        throw new AppError("Connectez le compte Meta avant de synchroniser.", 409);
      if (cfg.revision !== input.revision) throw changed();
      if (input.to > mediaToday(cfg.timeZone))
        throw new AppError("La période ne peut pas se terminer dans le futur.", 400);
      if (cfg.syncLease && cfg.syncLockedUntil && cfg.syncLockedUntil > new Date())
        throw new AppError("Une synchronisation Meta est déjà en cours.", 409);
      await tx.mediaBuyerConnection.update({
        where: { id: "meta" },
        data: { syncLease: lease, syncLockedUntil: new Date(Date.now() + 120000) },
      });
      return {
        ...cfg,
        accountId: cfg.accountId,
        currency: cfg.currency,
        timeZone: cfg.timeZone,
        tokenCiphertext: cfg.tokenCiphertext,
      };
    },
    { isolationLevel: "ReadCommitted" },
  );
  try {
    const credential = openToken(row.accountId, row.tokenCiphertext),
      deadline = Date.now() + 75000;
    const metadata = await readMetaAccount(row.accountId, credential, deadline);
    if (metadata.currency !== row.currency || metadata.timeZone !== row.timeZone)
      throw new AppError(
        "La devise ou le fuseau Meta a changé. Reconnectez le compte avant de synchroniser.",
        409,
      );
    const records = await readMetaSpend(
      row.accountId,
      credential,
      input.from,
      input.to,
      row.currency,
      deadline,
    );
    const ads = new Map(records.map((r) => [r.adId, r]));
    const syncedAt = new Date(),
      first = new Date(input.from),
      last = new Date(input.to);
    await prisma.$transaction(
      async (tx) => {
        await lockTeam(tx, actor);
        const current = await tx.mediaBuyerConnection.findUnique({ where: { id: "meta" } });
        if (
          !current ||
          current.revision !== row.revision ||
          current.syncLease !== lease ||
          current.accountId !== row.accountId
        )
          throw changed();
        for (const ad of ads.values()) {
          const previous = await tx.metaAd.findUnique({
            where: { accountId_adId: { accountId: row.accountId, adId: ad.adId } },
          });
          if (
            previous &&
            (previous.campaignId !== ad.campaignId || previous.adsetId !== ad.adsetId)
          )
            throw new MetaReadError("format");
          const data = {
            campaignId: ad.campaignId,
            campaignName: ad.campaignName,
            adsetId: ad.adsetId,
            adsetName: ad.adsetName,
            adName: ad.adName,
          };
          await tx.metaAd.upsert({
            where: { accountId_adId: { accountId: row.accountId, adId: ad.adId } },
            create: { accountId: row.accountId, adId: ad.adId, ...data },
            update: data,
          });
        }
        await tx.metaDailySpend.deleteMany({
          where: { accountId: row.accountId, date: { gte: first, lte: last } },
        });
        for (let i = 0; i < records.length; i += 500)
          await tx.metaDailySpend.createMany({
            data: records
              .slice(i, i + 500)
              .map((r) => ({
                accountId: row.accountId,
                adId: r.adId,
                date: new Date(r.date),
                spendMicros: r.spendMicros,
                currency: row.currency,
                timeZone: row.timeZone,
              })),
          });
        for (const day of days)
          await tx.metaSyncDay.upsert({
            where: { accountId_date: { accountId: row.accountId, date: new Date(day) } },
            create: {
              accountId: row.accountId,
              date: new Date(day),
              currency: row.currency,
              timeZone: row.timeZone,
              syncedAt,
            },
            update: { currency: row.currency, timeZone: row.timeZone, syncedAt },
          });
        await tx.mediaBuyerConnection.update({
          where: { id: "meta" },
          data: {
            accountName: metadata.accountName,
            lastSyncAt: syncedAt,
            lastError: null,
            syncLease: null,
            syncLockedUntil: null,
          },
        });
        await tx.accessEvent.create({
          data: { actorId: actor.id, action: "MEDIA_BUYER_SYNC_COMPLETED" },
        });
      },
      { isolationLevel: "ReadCommitted", timeout: 25000 },
    );
    return { days: days.length, rows: records.length, syncedAt: syncedAt.toISOString() };
  } catch (error) {
    const safe = error instanceof AppError ? error : new MetaReadError("network");
    await prisma.mediaBuyerConnection.updateMany({
      where: { id: "meta", revision: row.revision, syncLease: lease },
      data: { lastError: safe.message, syncLease: null, syncLockedUntil: null },
    });
    throw safe;
  }
}
