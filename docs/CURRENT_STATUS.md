# Current Status — 2026-10-18

## Hostinger runtime repair — 2026-10-19

See `HOSTINGER_RUNTIME_2026-10-19.md`. The root build now includes Prisma generation and backend compilation. An explicit combined hosting mode serves Express and Next through one public listener, with shared public read services for server rendering and a single host-managed listener. Local standalone mode is retained. The hosted entrypoint does not start background CRM/Sheets workers, seed products or change accounts; existing database and credentials remain authoritative. Production validation is recorded separately after deployment.

## Priority fixes implemented and locally verified

See [PRIORITY_FIXES_2026-10-18.md](PRIORITY_FIXES_2026-10-18.md) for the ten P1 corrections, operating instructions and remaining limits.

- Next 16.4.2, React 19.3.1 and Tailwind 4.3.3: backend compilation, frontend lint, type checks and production build pass. Fresh candidate dependency installation was used; npm audit reports zero vulnerabilities at verification time.
- Twelve isolated integration scenarios pass, including concurrent checkout, one local CRM event per order, stable retry keys, competing stock reservations and repeated cancellation. A local CRM simulator receives delivery tests.
- Browser verification in the isolated production build: administrator login, product name/stock update, storefront and successful checkout. Confirmation now scrolls into view. Narrow viewport measured 386 CSS pixels without horizontal overflow.
- Tested source and independently copied dependencies applied to the active local application after backup. Frontend and backend restarted; port 3000 storefront and API proxy verified. The existing pre-migration frontend supervisor needs the local development flag supplied through `.env.development.local`; a fresh `npm run dev` sets this automatically. No private environment file is tracked.
- Eleven known test/demo product records preserved as DRAFT after backing up their previous values. No ready commercial products remain in the storefront; actual product information and photographs must be supplied before sales.
- Active local order count, all eight CRM outbox states/attempt counts and manually maintained order indexes unchanged after application. Historical outbox cutoff preserved.
- CI verifies compilation, lint, build, isolated integration tests and dependency advisories on pull requests and updates of Master.

## Previous integration proof

PR #2 synchronized the local storefront and CRM integration; PR #3 recorded the audit. An earlier separately authorized synthetic checkout was observed as one local order, one SENT outbox row, one CRM receipt and one pipeline lead. No new order was sent to the real CRM for this correction batch.

## Remaining limits

- Telegram requires matching webhook-secret configuration and verified contact sharing before receiving customer notifications. Unverified old associations are ignored.
- Card-payment endpoints are closed; COD remains available. Stripe must be redesigned and tested before reactivation.
- Historical orders without a verified reservation require stock reconciliation before cancellation. No historical stock adjustment was guessed.
- The eleven P2 audit findings are implemented; see USABILITY_PERFORMANCE_2026-10-18.md for scope, verification, local measurements and owner content still required. No production field-performance certification is claimed.
- Preserve the historical CRM cutoff and manually managed database indexes. Never replay historical jobs as part of tests.

## Usability and performance follow-up

Twenty isolated scenarios pass. Public pages render their useful data on the server; product metadata, real 404s, robots and sitemap are implemented. Cart reconciliation, recovery after network failure, accessible dialogs, server-backed content publication and session renewal were verified in browsers. The public catalog remains empty until real products are supplied. Commercial terms require owner validation; generic pages do not invent delivery times or return rules.

Applied follow-up: the active port 3000 frontend and port 4000 backend have been restarted and verified. Live order count, all eight outbox rows (including attempts), product statuses and manually maintained order indexes match the pre-application snapshot. No site content was published on the active database.

## Explicitly authorized local test catalogue

The owner clarified that new catalogue entries are for testing, not real merchandise. Three labelled synthetic products with built-in imagegen WebP images and five variants were installed on local port 3000. See `catalogue/local-test/README.md` for fictional prices, provenance, strict opt-in installation and archive rollback. One browser checkout was verified, cancelled and its reserved stock restored; no new CRM event and no change to the eight previous outbox records. Real commercial product information remains outstanding.

## Storefront UI/UX redesign

See `STOREFRONT_DESIGN_2026-10-18.md`. The storefront uses a consistent ivory/forest palette, editorial home layout, category tiles, redesigned product cards, navigation and footer. Self-hosted Tajawal improves Arabic body text while Amiri headings and a Cormorant wordmark provide contrast. Product/checkout presentation and filter disclosure were refined. Backend and CRM logic are unchanged.

## Administration design and usability

See `ADMIN_WORKSPACE_2026-10-18.md`. A scoped ivory/forest admin workspace replaces the dark mixed-language tabs. Navigation, product/order search, editor feedback, session/sync states and mobile controls are clearer. Financial cards no longer invent a profit margin; their loaded-data scope is explicit. Frontend order actions follow existing backend transitions. Twenty-two isolated tests pass. After the owner stopped the old frontend, the tested production build was started on port 3000. Live authenticated browser checks verified dashboard rendering, product/order search and opening/cancelling the product editor. Order count, all CRM outbox states/attempts, product prices/statuses and variant stock match the pre-application snapshot. No backend, database schema or CRM configuration changes are part of this lot.

## Order tracking and detail follow-up

See `ORDER_WORKSPACE_2026-10-18.md`. Orders now have status counters, date/payment filters, sorting and an accessible detail dialog with delivery, recorded line prices, totals, notes and current progress. Every status change requires confirmation; uncertain writes/failed post-write refreshes require a successful manual refresh before further actions. Twenty-four isolated tests pass. Isolated browser checks cover lifecycle, cancellation/stock restoration, mobile layout and post-write read failure recovery. Port 3000 was restarted and its authenticated search/detail flow verified read-only. Live order statuses/payments/totals, outbox states/attempts, prices and stocks match the baseline. Loaded selection remains limited to the latest 100 orders; no historical transition dates or real-time carrier tracking are claimed.

## Product, photo and inventory follow-up

See `PRODUCT_STOCK_WORKSPACE_2026-10-18.md`. The product editor groups identity, photos and variants, with multi-file uploads/progress, cover/order controls, size generation, safe duplication, loaded-stock deltas and dirty-form protection. Stock filters distinguish partial low stock, complete stockouts and missing variants. Successful writes are distinguished from failed catalogue refreshes; uncertain saves require verification. Existing backend stock concurrency and publication rules remain authoritative. Twenty-eight isolated tests pass; browser checks verify two uploads, persisted cover order, three generated variants, duplicate SKU rejection, retained inputs and concurrent stock conflict/reload recovery. Desktop/mobile layouts and read-only active port 3000 search/editor checks pass. No live catalogue, inventory, order or CRM mutation is part of this phase.
