-- Additive only: old orders stay NULL, with no reconstructed attribution.
ALTER TABLE "orders" ADD COLUMN "campaignAttribution" JSONB,
    ADD COLUMN "campaignAttributionExpiresAt" TIMESTAMP(3);
CREATE INDEX "orders_campaign_retention" ON "orders" ("campaignAttributionExpiresAt");
