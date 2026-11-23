CREATE TABLE "pos_sales" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "idempotencyKey" TEXT NOT NULL UNIQUE, "requestFingerprint" TEXT NOT NULL,
 "cashierId" TEXT NOT NULL, "cashierName" TEXT NOT NULL,
 "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('CASH','CARD_TERMINAL')),
 "totalCents" INTEGER NOT NULL CHECK ("totalCents" >= 0),
 "savingsCents" INTEGER NOT NULL CHECK ("savingsCents" >= 0),
 "receivedCents" INTEGER NOT NULL, "changeCents" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "pos_tender" CHECK ("receivedCents" >= "totalCents" AND "changeCents" = "receivedCents" - "totalCents"
   AND ("paymentMethod" = 'CASH' OR "receivedCents" = "totalCents"))
);
CREATE INDEX "pos_sales_cashierId_createdAt_idx" ON "pos_sales" ("cashierId","createdAt");
CREATE INDEX "pos_sales_createdAt_idx" ON "pos_sales" ("createdAt");
CREATE TABLE "pos_sale_items" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "saleId" TEXT NOT NULL REFERENCES "pos_sales"("id") ON DELETE RESTRICT,
 "position" INTEGER NOT NULL, "productId" TEXT NOT NULL, "variantId" TEXT NOT NULL,
 "sku" TEXT NOT NULL, "nameFr" TEXT NOT NULL, "nameAr" TEXT NOT NULL,
 "colorFr" TEXT NOT NULL, "colorAr" TEXT NOT NULL, "size" TEXT,
 "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
 "unitPriceCents" INTEGER NOT NULL CHECK ("unitPriceCents" >= 0),
 "totalCents" INTEGER NOT NULL CHECK ("totalCents" >= 0),
 UNIQUE ("saleId","position")
);
