-- NULL preserves the installation's existing links. Empty text deliberately hides a link.
ALTER TABLE "store_settings"
    ADD COLUMN "whatsappUrl" TEXT,
    ADD COLUMN "instagramUrl" TEXT,
    ADD COLUMN "facebookUrl" TEXT,
    ADD COLUMN "tiktokUrl" TEXT;
