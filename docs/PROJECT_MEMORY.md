# Imad Store — Persistent Project Memory

Updated 2026-10-18. This document describes an observed development state, not a production certification.

## Architecture
- Monorepo: Next.js frontend in `apps/web`, Express/TypeScript backend in `backend`, Prisma and MongoDB replica set.
- Development ports: frontend 3000, backend 4000, MongoDB 27017.
- Source code used during testing: `/Users/jobamafa/Downloads/imad_crm_phase01/candidates/phase08-20261017T115243Z-42791` (local Mac path; not portable).
- Backend Prisma schema: `backend/prisma/schema.prisma`.

## Verified functional state (2026-10-18)
- Products collection: 11 ACTIVE products, of which 10 are labeled `[TEST 19A]`; these 10 have no images and no variants. Their test categories were all assigned to Bags. These are synthetic test records, not ready for commerce.
- `/api/products` returned HTTP 200 with 11 items; user confirmed catalog visibility subsequently.
- DeskcommCRM integration via encrypted config, order outbox, and periodic worker; observed TICK/ACTIVE markers at ~15-second spacing.
- Read-only outbox audit: 7 entries, 5 SENT and 2 old PENDING, no duplicate order IDs in outbox. Newest test order `6ad5036598784c2e0d8d032c` SENT with 1 attempt; user confirmed CRM receipt. CRM-side uniqueness remains to be independently checked.
- Historical PENDING records must not be replayed. Last confirmed launch cutoff: `2026-10-18T00:00:30.000Z`. Before starting a backend, verify its current configuration rather than assuming persistence.

## Safety
- Never commit secrets or user/customer data to Git.
- Do not execute `prisma db push` on the active MongoDB database; manually managed partial unique index for order idempotency may be affected.
- No automatic sending of old orders or webhooks; maintain explicit approval for live delivery tests.
- Every phase should emit a new, uniquely named TXT report, without overwriting prior reports.

## Git sync status
On 2026-10-18 a read-only comparison with `medboua83/imad-store` branch `Master` at `b9c6c0ed78b3` identified 15 changed files and 8 locally-only files (including generated TS artifacts), with 67 identical. Git Memory 03 creates an isolated comparison candidate; no push or commit should be presumed.

## Synchronization follow-up — 2026-10-18

The prepared candidate was copied into an isolated workspace, compared with the local source, and corrected until the frontend production build and backend typecheck passed. No active runtime or database changes were applied. See CURRENT_STATUS.md for verification limits.

## Browser QA follow-up — 2026-10-18

Read-only browser testing used the existing API with an isolated frontend on port 3100. Fixed API access, mock homepage cart entries, missing standalone image rendering, contact navigation, checkout field labels and shipping mismatch. Test-only catalog records were retained. No successful checkout or CRM delivery was attempted. API_UPSTREAM_URL selects the same-origin proxy target at build time; defaults to the local API on port 4000. Explicit NEXT_PUBLIC_API_URL overrides the browser base URL and requires matching backend CORS configuration.
