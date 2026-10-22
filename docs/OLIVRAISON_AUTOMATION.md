# Olivraison automation

Depends on the direct site confirmation feature (PR #48). Integration defaults OFF. No production deployment or live shipment is part of this change.

## Configuration

Dashboard → Paramètres → Olivraison. Save the partner API key and secret, pickup address, exact city mappings and auto-pickup preference. Credentials use AES-256-GCM with the existing deployment DESKCOMM_ENCRYPTION_KEY; they are never returned or logged. Back up this encryption key using the existing secret-management procedure. Changing carrier account is blocked while unfinished shipment records exist. The connection test only authenticates and reads cities; it creates no parcel. The documentation exposes no public sandbox.

Enabling includes only orders created after the latest activation and confirmed while enabled. Historical orders and orders created while disabled are never backfilled. PENDING orders wait for the existing CRM/admin confirmation. The default auto-pickup setting requests collection immediately after confirmation: only enable this when parcels can be prepared promptly. Physical packing, printing and handing parcels to the driver still require staff.

## Flow

A shipment row keyed by the order ID is enqueued in the order/status transaction. A database lease serializes processing across app instances. Hosted and standalone launchers run a non-overlapping timer every 15 seconds; each cycle handles one due shipment. Active shipments are polled at roughly five-minute intervals, depending on volume. No external call occurs while disabled. All instances share a database request gate (one call per 260ms, below the documented five requests/second).

The worker uses POST /package/new with the persisted order ID as both orderId (documented carrier idempotency key) and partnerTrackingID. COD is the server-calculated saved total including shipping; inventory=false avoids a second inventory reservation. Exact city mapping and carrier address constraints are validated before sending. It then reads the remote package, confirms CREATED via POST /package/status, and optionally creates a pickup using only this shipment's tracking ID. Never uses the account-wide ["*"] pickup. PDF links are accepted only on the fixed HTTPS partners.olivraison.com origin.

Network failures use bounded exponential backoff. A pickup-attempt checkpoint is committed before requesting collection. An uncertain pickup is reconciled via GET; it is never blindly sent a second time. If the carrier reports PICKUP but the response containing the PDFs was lost, staff retrieve the PDFs in their carrier account. “Revérifier le colis” re-reads the remote state, retaining that checkpoint. It cannot force a second pickup. Invalid addresses/cities can be corrected, then rechecked. Carrier-side edits and cancellations require reconciliation; cancelled local orders stop all new external requests. Cancellation after dispatch, returns, missing PDF responses and conflicting references require attention rather than unsafe stock/refund changes.

Carrier TRANSIT/RECIVED/PICKEDUP/SCHEDULED/REPORTED moves a confirmed order to SHIPPED; DELIVERED follows the existing SHIPPED → DELIVERED transition. Customer confirmation remains distinct from carrier receipt. Delivered COD remains payment PENDING until remittance is independently reconciled. Returns/cancellations never automatically replenish stock or mark refunds. CRM/webhook payloads and the historical delivery cutoff are unchanged.

## Validation and deployment

Tests use isolated database records and fake carrier responses. Unit tests cover credentials, exact cities, totals, idempotency identity, rate gating, safe PDF URLs and sanitized retry errors. Integration tests cover opt-in persistence, authentication, encryption, no backfill, direct/manual confirmation, repeated/concurrent processing, transient creation failure, single pickup, uncertain pickup, cancellation and delivery without invented COD settlement. Playwright covers dashboard activation/deactivation, persistence, masked secret clearing, tracking/PDF links and mobile/desktop layout.

No schema push/migration is required on the active database: these new MongoDB collections use their built-in _id primary key; no additional unique index is needed. Generate Prisma and build before deploying through the existing Hostinger flow, preserving all existing secrets and CRM cutoff. No database destructive operation, replay, live carrier test or production deployment is authorized by this PR.

Operational limits: Hostinger must keep/wake the Node process for timers to run. Exceptions still require human correction. Production API credentials and a real pickup/label test remain unverified until the administrator configures and explicitly authorizes them. Disable the integration to pause automation; already-created remote parcels remain in the carrier account.

Reference: https://partners.olivraison.com/docs#description/introduction (OpenAPI v1, reviewed 2026-10-22).
