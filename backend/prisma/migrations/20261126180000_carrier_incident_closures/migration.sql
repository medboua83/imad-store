BEGIN;
ALTER TABLE "olivraison_shipments" ADD COLUMN "incidentVersion" INTEGER NOT NULL DEFAULT 0;

-- Advance only for a new incident, never for a lease or successful tracking timestamp.
-- The trigger also covers older runtimes and administrative retries after rollback.
CREATE FUNCTION imad_carrier_incident_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW."trackingId", NEW."state", NEW."carrierStatus", NEW."lastError")
       IS DISTINCT FROM ROW(OLD."trackingId", OLD."state", OLD."carrierStatus", OLD."lastError") THEN
        NEW."incidentVersion" := OLD."incidentVersion" + 1;
    ELSE
        NEW."incidentVersion" := OLD."incidentVersion";
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER imad_carrier_incident_version BEFORE UPDATE ON "olivraison_shipments"
    FOR EACH ROW EXECUTE FUNCTION imad_carrier_incident_version();

CREATE TABLE "carrier_incident_closures" (
    "id" TEXT NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
    "orderId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "shipmentState" TEXT NOT NULL,
    "carrierStatus" TEXT,
    "incidentError" TEXT,
    "incidentVersion" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "carrier_incident_closures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "carrier_incident_closures_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 10 AND 1000),
    CONSTRAINT "carrier_incident_closures_fingerprint_check" CHECK ("fingerprint" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "carrier_incident_closures_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "carrier_incident_closures_orderId_fingerprint_key" ON "carrier_incident_closures"("orderId", "fingerprint");
CREATE INDEX "carrier_incident_closures_orderId_closedAt_idx" ON "carrier_incident_closures"("orderId", "closedAt");
COMMIT;
