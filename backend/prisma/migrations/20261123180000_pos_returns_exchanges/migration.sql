BEGIN;
CREATE TABLE "pos_adjustments" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "idempotencyKey" TEXT NOT NULL UNIQUE, "requestFingerprint" TEXT NOT NULL,
 "rootSaleId" TEXT NOT NULL REFERENCES "pos_sales"(id) ON DELETE RESTRICT,
 "sourceSaleId" TEXT REFERENCES "pos_sales"(id) ON DELETE RESTRICT,
 "sourceAdjustmentId" TEXT REFERENCES "pos_adjustments"(id) ON DELETE RESTRICT,
 "cashierId" TEXT NOT NULL, "cashierName" TEXT NOT NULL,
 "cashSessionId" TEXT NOT NULL REFERENCES "pos_cash_sessions"(id) ON DELETE RESTRICT,
 "returnCents" INTEGER NOT NULL CHECK ("returnCents" >= 0),
 "replacementCents" INTEGER NOT NULL CHECK ("replacementCents" >= 0),
 "netCents" INTEGER NOT NULL CHECK ("netCents" = "replacementCents" - "returnCents"),
 "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('CASH','CARD_TERMINAL','NONE')),
 "receivedCents" INTEGER NOT NULL CHECK ("receivedCents" >= 0), "changeCents" INTEGER NOT NULL CHECK ("changeCents" >= 0),
 "note" TEXT NOT NULL CHECK (length(trim("note")) >= 3 AND length("note") <= 500),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("sourceSaleId" IS NOT NULL) <> ("sourceAdjustmentId" IS NOT NULL)),
 CHECK (("netCents" < 0 AND "paymentMethod"='CASH' AND "receivedCents"=0 AND "changeCents"=0)
     OR ("netCents"=0 AND "paymentMethod"='NONE' AND "receivedCents"=0 AND "changeCents"=0)
     OR ("netCents">0 AND "paymentMethod" IN ('CASH','CARD_TERMINAL') AND "receivedCents">="netCents" AND "changeCents"="receivedCents"-"netCents" AND ("paymentMethod"='CASH' OR "receivedCents"="netCents")))
);
CREATE INDEX "pos_adjustments_rootSaleId_idx" ON "pos_adjustments"("rootSaleId");
CREATE INDEX "pos_adjustments_sourceSaleId_idx" ON "pos_adjustments"("sourceSaleId");
CREATE INDEX "pos_adjustments_sourceAdjustmentId_idx" ON "pos_adjustments"("sourceAdjustmentId");
CREATE INDEX "pos_adjustments_cashSessionId_idx" ON "pos_adjustments"("cashSessionId");
CREATE INDEX "pos_adjustments_cashierId_createdAt_idx" ON "pos_adjustments"("cashierId","createdAt");
CREATE TABLE "pos_adjustment_items" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "adjustmentId" TEXT NOT NULL REFERENCES "pos_adjustments"(id) ON DELETE RESTRICT,
 "position" INTEGER NOT NULL CHECK ("position">=0),
 "kind" TEXT NOT NULL CHECK ("kind" IN ('RETURN','REPLACEMENT')),
 "sourceItemId" TEXT, "restock" BOOLEAN,
 "productId" TEXT NOT NULL, "variantId" TEXT NOT NULL, "sku" TEXT NOT NULL,
 "nameFr" TEXT NOT NULL, "nameAr" TEXT NOT NULL, "colorFr" TEXT NOT NULL, "colorAr" TEXT NOT NULL, "size" TEXT,
 "quantity" INTEGER NOT NULL CHECK ("quantity">0 AND "quantity"<=1000),
 "unitPriceCents" INTEGER NOT NULL CHECK ("unitPriceCents">=0), "totalCents" INTEGER NOT NULL CHECK ("totalCents">=0),
 UNIQUE("adjustmentId","position"),
 CHECK (("kind"='RETURN' AND "sourceItemId" IS NOT NULL AND "restock" IS NOT NULL) OR ("kind"='REPLACEMENT' AND "sourceItemId" IS NULL AND "restock" IS NULL))
);
CREATE INDEX "pos_adjustment_items_sourceItemId_idx" ON "pos_adjustment_items"("sourceItemId");
ALTER TABLE "pos_cash_closings" ADD COLUMN "adjustmentCents" BIGINT NOT NULL DEFAULT 0,
 ADD COLUMN "cardAdjustmentCents" BIGINT NOT NULL DEFAULT 0,
 ADD COLUMN "adjustmentCount" INTEGER NOT NULL DEFAULT 0 CHECK ("adjustmentCount">=0);
DO $$
DECLARE constraint_name TEXT;
BEGIN
 SELECT conname INTO STRICT constraint_name FROM pg_constraint WHERE conrelid='pos_cash_closings'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%"expectedCents" >= "cashCents"%';
 EXECUTE format('ALTER TABLE pos_cash_closings DROP CONSTRAINT %I',constraint_name);
END $$;
ALTER TABLE "pos_cash_closings" ADD CONSTRAINT "pos_cash_closings_expectedCents_check" CHECK ("expectedCents">=0);
-- Reuse the session ownership guard for immutable adjustments as well.
CREATE TRIGGER "pos_adjustment_cash_session_guard" BEFORE INSERT ON "pos_adjustments" FOR EACH ROW EXECUTE FUNCTION imad_check_cash_session();
-- A downgraded application may never close a drawer while silently ignoring returns.
CREATE FUNCTION imad_check_return_closing() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n INTEGER; cash_sum BIGINT; card_sum BIGINT;
BEGIN
 SELECT count(*), coalesce(sum("netCents") FILTER(WHERE "paymentMethod"='CASH'),0), coalesce(sum("netCents") FILTER(WHERE "paymentMethod"='CARD_TERMINAL'),0)
 INTO n,cash_sum,card_sum FROM "pos_adjustments" WHERE "cashSessionId"=NEW."sessionId";
 IF NEW."adjustmentCount"<>n OR NEW."adjustmentCents"<>cash_sum OR NEW."cardAdjustmentCents"<>card_sum THEN
  RAISE EXCEPTION 'Return ledger must be included in closing' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "pos_closing_return_guard" BEFORE INSERT ON "pos_cash_closings" FOR EACH ROW EXECUTE FUNCTION imad_check_return_closing();
COMMIT;
