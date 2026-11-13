-- Optional public verification token; existing settings and data remain unchanged.
ALTER TABLE "store_settings" ADD COLUMN "metaDomainVerification" TEXT;
