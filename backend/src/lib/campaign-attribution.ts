import { Request } from "express";
import { Prisma } from "@prisma/client";
import { validCampaignAttribution, CAMPAIGN_ORDER_RETENTION_MS } from "@imad-store/shared";
import { prisma } from "./prisma";
import { assertStoreInstallation } from "./store-installation";
import { hasAdminCookie } from "./admin-cookies";
export function campaignForOrder(input: unknown, req: Request, now = Date.now()) {
  if (
    req.headers.authorization ||
    hasAdminCookie(req) ||
    req.header("DNT") === "1" ||
    req.header("Sec-GPC") === "1" ||
    req.header("X-Analytics-Test") === "1"
  )
    return {};
  const touch = validCampaignAttribution(input, now);
  if (!touch) return {};
  return {
    campaignAttribution: touch as unknown as Prisma.InputJsonValue,
    campaignAttributionExpiresAt: new Date(now + CAMPAIGN_ORDER_RETENTION_MS),
  };
}
export function privateCampaign<
  T extends { campaignAttribution?: unknown; campaignAttributionExpiresAt?: Date | null },
>(order: T) {
  return {
    ...order,
    ...(order.campaignAttributionExpiresAt &&
    order.campaignAttributionExpiresAt.getTime() > Date.now()
      ? {}
      : { campaignAttribution: null, campaignAttributionExpiresAt: null }),
  };
}
export function publicOrder<
  T extends { campaignAttribution?: unknown; campaignAttributionExpiresAt?: unknown },
>(order: T) {
  const { campaignAttribution: _touch, campaignAttributionExpiresAt: _expiry, ...receipt } = order;
  return receipt;
}
/** Indexed purge clears only advertising metadata; business timestamps and orders remain intact. */
export async function purgeExpiredCampaigns(now = new Date()) {
  await assertStoreInstallation();
  return prisma.$executeRaw`UPDATE "orders" SET "campaignAttribution" = NULL, "campaignAttributionExpiresAt" = NULL
        WHERE "campaignAttributionExpiresAt" <= ${now.toISOString().replace("T", " ").replace("Z", "")}::timestamp`;
}
export function startCampaignRetention() {
  const run = () => {
    void purgeExpiredCampaigns().catch(() => console.error("Campaign retention failed"));
  };
  run();
  const timer = setInterval(run, 3600_000);
  timer.unref();
  return () => clearInterval(timer);
}
