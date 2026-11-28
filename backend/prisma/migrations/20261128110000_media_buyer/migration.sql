-- Additive only. No order, payment, inventory, shipment or existing account is rewritten.
CREATE TABLE "media_buyer_connection" (
 "id" TEXT PRIMARY KEY, "accountId" TEXT, "accountName" TEXT, "currency" TEXT, "timeZone" TEXT,
 "tokenCiphertext" TEXT, "targetCents" INTEGER, "revision" INTEGER NOT NULL DEFAULT 1,
 "lastSyncAt" TIMESTAMP(3), "lastError" TEXT, "syncLease" TEXT, "syncLockedUntil" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "media_target_positive" CHECK ("targetCents" IS NULL OR "targetCents" BETWEEN 1 AND 100000000)
);
CREATE TABLE "meta_ads" (
 "accountId" TEXT NOT NULL, "adId" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "campaignName" TEXT NOT NULL,
 "adsetId" TEXT NOT NULL, "adsetName" TEXT NOT NULL, "adName" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("accountId", "adId")
);
CREATE INDEX "meta_ads_accountId_campaignId_adsetId_idx" ON "meta_ads"("accountId", "campaignId", "adsetId");
CREATE TABLE "meta_daily_spend" (
 "accountId" TEXT NOT NULL, "adId" TEXT NOT NULL, "date" DATE NOT NULL, "spendMicros" BIGINT NOT NULL,
 "currency" TEXT NOT NULL, "timeZone" TEXT NOT NULL,
 PRIMARY KEY ("accountId", "adId", "date"),
 CONSTRAINT "meta_daily_spend_nonnegative" CHECK ("spendMicros" >= 0),
 CONSTRAINT "meta_daily_spend_ad_fkey" FOREIGN KEY ("accountId", "adId") REFERENCES "meta_ads"("accountId", "adId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "meta_daily_spend_accountId_date_idx" ON "meta_daily_spend"("accountId", "date");
CREATE TABLE "meta_sync_days" (
 "accountId" TEXT NOT NULL, "date" DATE NOT NULL, "currency" TEXT NOT NULL, "timeZone" TEXT NOT NULL, "syncedAt" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("accountId", "date")
);
CREATE INDEX "order_events_orderId_type_idx" ON "order_events"("orderId", "type");
