# Purchase reporting currency

The Meta browser SDK rejects MAD for Purchase. The shop continues to sell and
record orders in MAD. An optional `metaPixelMadPerUsd` store setting converts
the order total to USD for Meta only, rounded to two decimal places.

The administrator enters the number of MAD for one USD. There is no invented
default or automatic FX update. Missing or invalid rates suppress Purchase;
PageView, ViewContent and InitiateCheckout are unaffected. The owner selected
a manual reference of 11 MAD per USD for their installation.

The setting is optional for existing MongoDB documents; deployment requires
Prisma client generation, not `db push` or a database rewrite.

Each Purchase retains `order-<orderId>` as its eventID. In-memory, persistent
local storage and legacy session storage checks suppress repeat submissions.
This is client-side duplicate suppression, not a delivery acknowledgement from
Meta. Advertising failures never interrupt order creation. No historical order
is replayed automatically, and a cancelled order does not generate Purchase.

Validation includes conversion/rounding, invalid rates, persistent duplicate
markers, unchanged privacy exclusions, and authenticated settings validation.
Real receipt must additionally be checked in Meta Test Events; unit tests
cannot certify external delivery. COD Purchase represents order placement,
not collected payment.
