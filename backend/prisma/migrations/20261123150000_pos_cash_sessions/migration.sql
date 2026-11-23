BEGIN;
CREATE TABLE "pos_cash_sessions" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "openKey" TEXT NOT NULL UNIQUE CHECK (left("openKey",5) = 'open_'), "requestFingerprint" TEXT NOT NULL,
 "cashierId" TEXT NOT NULL, "cashierName" TEXT NOT NULL,
 "openingCents" INTEGER NOT NULL CHECK ("openingCents" >= 0),
 "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pos_cash_sessions_cashierId_openedAt_idx" ON "pos_cash_sessions" ("cashierId","openedAt");
CREATE TABLE "pos_cash_registers" (
 "cashierId" TEXT PRIMARY KEY,
 "activeSessionId" TEXT UNIQUE REFERENCES "pos_cash_sessions"("id") ON DELETE RESTRICT
);
CREATE TABLE "pos_cash_closings" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "sessionId" TEXT NOT NULL UNIQUE REFERENCES "pos_cash_sessions"("id") ON DELETE RESTRICT,
 "closeKey" TEXT NOT NULL UNIQUE CHECK (left("closeKey",6) = 'close_'), "requestFingerprint" TEXT NOT NULL,
 "countedCents" INTEGER NOT NULL CHECK ("countedCents" >= 0),
 "cashCents" BIGINT NOT NULL CHECK ("cashCents" >= 0), "cardCents" BIGINT NOT NULL CHECK ("cardCents" >= 0),
 "cashCount" INTEGER NOT NULL CHECK ("cashCount" >= 0), "cardCount" INTEGER NOT NULL CHECK ("cardCount" >= 0),
 "expectedCents" BIGINT NOT NULL CHECK ("expectedCents" >= "cashCents"),
 "differenceCents" BIGINT NOT NULL CHECK ("differenceCents" = "countedCents"::bigint - "expectedCents"),
 "note" TEXT NOT NULL CHECK (length("note") <= 500 AND ("differenceCents" = 0 OR length(trim("note")) >= 3)),
 "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "pos_sales" ADD COLUMN "cashSessionId" TEXT REFERENCES "pos_cash_sessions"("id") ON DELETE RESTRICT;
CREATE INDEX "pos_sales_cashSessionId_idx" ON "pos_sales" ("cashSessionId");
-- Old receipts stay unassigned. An older application cannot silently bypass an opted-in cashier's session.
CREATE FUNCTION imad_check_cash_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_id TEXT; tracked BOOLEAN;
BEGIN
 SELECT "activeSessionId", true INTO active_id, tracked FROM "pos_cash_registers" WHERE "cashierId" = NEW."cashierId" FOR UPDATE;
 IF coalesce(tracked,false) THEN
  IF active_id IS NULL OR NEW."cashSessionId" IS DISTINCT FROM active_id
    OR NOT EXISTS (SELECT 1 FROM "pos_cash_sessions" s WHERE s.id=active_id AND s."cashierId"=NEW."cashierId")
    OR EXISTS (SELECT 1 FROM "pos_cash_closings" c WHERE c."sessionId"=active_id) THEN
   RAISE EXCEPTION 'A matching open cash session is required' USING ERRCODE = '23514';
  END IF;
 ELSIF NEW."cashSessionId" IS NOT NULL THEN
  RAISE EXCEPTION 'Cash register is not active' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "pos_sale_cash_session_guard" BEFORE INSERT ON "pos_sales" FOR EACH ROW EXECUTE FUNCTION imad_check_cash_session();

COMMIT;
