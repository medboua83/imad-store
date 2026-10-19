# CRM confirmation callback — 2026-10-19

The signed POST receiver `/api/integrations/deskcomm/status-callback` maps a configured CRM `lead.stage_changed` event to CONFIRMED on an existing order. It requires a full order ID and an already SENT outbound CRM delivery. It creates no order, payment, stock reservation or outgoing CRM event.

HMAC-SHA256 validates the raw body, signed timestamp and delivery UUID with a five-minute tolerance. Pipeline, destination/current stage, field key and historical cutoff are explicitly configured. Immutable delivery receipts and order changes share one transaction; concurrent/repeated callbacks create one status change. Manual resend timestamps do not defeat deduplication. Cancelled orders are rejected; shipped/delivered orders never regress.

Disabled by default. Activation requires a dedicated shared 64-hex-character signing secret and verified CRM mapping. No historical replay. Keep existing outgoing worker/cutoff settings unchanged. Rollback: disable DESKCOMM_STATUS_CALLBACK_ENABLED and pause the CRM rule. Receipts remain for audit; no database schema push is necessary (Mongo _id enforces uniqueness).

Configuration: DESKCOMM_STATUS_CALLBACK_ENABLED, DESKCOMM_STATUS_CALLBACK_SECRET, DESKCOMM_STATUS_PIPELINE_ID, DESKCOMM_STATUS_CONFIRMED_STAGE_ID, DESKCOMM_STATUS_ORDER_FIELD, DESKCOMM_STATUS_MIN_OCCURRED_AT (canonical UTC timestamp). Never put actual secrets in Git.

Validation: 31 isolated integration tests pass, including concurrent callbacks, invalid signatures, historical events, pipeline/stage/reference checks, outbound receipt gate, unchanged order/outbox counts, stock/payment preservation and cancelled/advanced states. Full production build and frontend lint pass. Production activation and end-to-end confirmation remain pending and must be reported separately.
