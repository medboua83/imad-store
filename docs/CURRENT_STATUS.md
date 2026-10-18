# Current Status — 2026-10-18

- Local application changes imported from the prepared Git Memory 03 candidate and compared with the active source.
- Frontend production build passes, including type and lint checks; existing non-blocking image and hook warnings remain.
- Backend TypeScript verification passes using the existing local dependency installation and generated Prisma client. A clean dependency installation has not been verified.
- Public seed endpoints remain disabled; private environment files are excluded from tracking.
- Admin compilation issues corrected; CRM order detail formatting uses actual line breaks.
- No active database writes, live checkout tests, webhook deliveries, or server restarts performed during this synchronization.
- Two historical PENDING outbox records must remain excluded by the configured cutoff.
- Browser QA on the isolated production frontend verified live catalog/search, empty categories, product details, cart quantity changes, shipping totals (329 MAD for one 299 MAD item; 598 MAD for two), required checkout fields, contact navigation, mobile menu and invalid admin login. No valid order was submitted. Authenticated administration and CRM delivery were not exercised.
- Homepage mock purchasable products replaced by real API data. Same-origin API fallback avoids browser cross-origin failures; set API_UPSTREAM_URL at build time for a separate backend host. NEXT_PUBLIC_API_URL remains supported.
- Images are served directly (unoptimized) to avoid missing sharp failures in standalone deployments.
- CRM-side duplicate prevention and production security readiness are not fully certified.
- Changes are proposed on a dedicated branch for review before merging and deployment.
