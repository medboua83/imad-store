# Current Status — 2026-10-18

## Completed

- Local storefront and CRM synchronization merged into Master through PR #2.
- Frontend production build, including lint and type checks, passed during synchronization; backend TypeScript verification passed using the existing dependency installation.
- The corrected frontend was applied to the active local application with file backups. Development-server restart and browser checks were observed.
- A separately authorized synthetic checkout succeeded: one local order, one SENT outbox event with one attempt, one CRM receipt and one pipeline lead. Order reference, item, quantity and total were verified in the CRM. No duplicate was observed for that single test; historical pending jobs remained unchanged.
- Public seed endpoints remain disabled and CRM configuration requires administrator authorization.

## Current audit

- See [AUDIT_SITE_2026-10-18.md](AUDIT_SITE_2026-10-18.md): 21 findings, including 10 P1 items and 11 P2 items.
- Public catalog: 11 active records, 10 without images and variants, one purchasable record, all mapped to bags. The demo image is not a real product photo.
- Prioritize guest-order confidentiality, integration authentication, payment gating, stock transitions, product administration and input validation before commercial launch.
- Production dependency-lock audit reports 22 vulnerable package entries (2 critical, 9 high, 11 moderate); exploitability depends on configuration and is not established by this count.
- No production Lighthouse/field performance score was measured. Narrow-browser CSS width observed was 484 px; smaller breakpoints still need verification.
- This audit changed documentation only: no new orders, payments, product changes, webhook deliveries or application fixes were performed during the audit.

## Remaining limits

- Forced retry/concurrency scenarios, cancellation stock reconciliation, authenticated administrator mutations and a clean dependency installation remain unverified.
- No complete security, accessibility, production deployment or legal compliance certification is claimed.
- Preserve the historical CRM outbox cutoff and manually managed database indexes. Never replay historical jobs as part of tests.
