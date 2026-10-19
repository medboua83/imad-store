# Mobile cart and checkout — 2026-10-19

The previous drawer separated quantities, delivery and the final amount without a clear visual hierarchy; mobile checkout placed its order summary below the form. This update continues the scoped ivory/forest storefront design.

## User-facing changes

- Shared product lines show a contained photograph, variant, unit price, quantity controls, explicit removal and line total. Decrement at one is disabled to avoid accidental removal.
- The drawer keeps its heading/close control and totals/action footer accessible while products scroll. It checks current prices/availability before offering checkout, blocks missing delivery fees, and exposes retry/recovery.
- Checkout shows a compact review before the form on phones, a sticky review beside the form on desktop, expandable product editing, grouped contact/address fields, phone keyboard/direction hints and an address textarea.
- The mobile confirmation bar keeps the amount due on delivery visible. Empty and confirmed-order states are presented consistently. Optional CRM sharing remains unchecked and explicitly optional.
- CartTotals is shared by both surfaces. It distinguishes delivery loading, unavailable fees, free delivery and a complete total; missing costs are never displayed as zero.

The existing submit handler is unchanged (verified by comparing its normalized source): field validation, price/stock refresh, delivery retry, COD payload, expectedTotal, consent and idempotency-key handling are preserved. No server, schema, pricing, stock or CRM setting changes are included.

## Candidate validation

Full production build, TypeScript and frontend lint pass. A loopback-only HTTP fixture proxies public GETs to the isolated frontend and intercepts every order POST locally; it never forwards an order request. Fictitious customer details were used only with that fixture.

- Empty submission marks four fields invalid and focuses the name.
- A simulated failure preserves form values; retry succeeds with the same idempotency key. Two local fixture calls (one error, one synthetic success), COD and CRM consent false, quantity 2 and expected total 428 verified. The synthetic success clears the local cart and displays its test reference.
- Delivery failure leaves continuation disabled and shows unavailable fees rather than a free/zero total. Retrying restores the real public settings.
- Quantity changes recalculate products/delivery/total: 398 + 30 = 428 MAD; 597 MAD qualifies for free delivery under the existing 500 MAD threshold.
- Decrease-at-one is disabled; explicit removal shows the empty bag state.

Responsive widths, final screenshots and deployed-domain checks are recorded in the separate execution report. Physical-device/keyboard testing is not claimed. No valid order is submitted on quickydev.com; live tests use temporary browser-cart changes and empty-field validation only. Reverting the previous release rolls back this UI without a database rollback.
