-- Existing CRM identities remain unchanged. New standalone stores have no CRM company.
ALTER TABLE "store_installation" ALTER COLUMN "companyId" DROP NOT NULL;
