# Meta PageView navigation ownership — 23 November 2026

The storefront already emits PageView from its pathname effect. Meta's browser SDK
also installs pushState, replaceState and popstate listeners by default. Those
listeners produced a second PageView on client-side navigation, including history
updates that did not change the pathname. The existing autoConfig opt-out controls
AutomaticSetup; it does not turn off this separate SDK navigation listener.

The Pixel queue now sets `disablePushState: true` before inserting fbevents.js.
The storefront remains responsible for PageView, ViewContent and InitiateCheckout.
Purchase still follows a successful order response, converts MAD with the saved
rate, and uses the order event ID and existing browser persistence to prevent
repetition. Tracking exclusions and recorded refusals remain in effect.

Regression coverage exercises a simulated SDK history listener with real Next
navigation on phone and desktop: initial load, product/shop links, back, forward,
same-URL replaceState and reload. A fictitious checkout response checks Purchase
value, event identity and non-repetition. The advertising SDK and order endpoint
are intercepted; these tests never call Meta, the carrier or the live store.

The SDK contract was checked against the live Meta script at
https://connect.facebook.net/en_US/fbevents.js (`signalsFBEventsSPANavigationUtil`).
Release validation and private deployment artifacts are kept on DATA under
`outputs/meta-pageview-dedup-20261123`. Verify the deployed script with a fresh
browser document: already-open documents retain their previously loaded SDK.

No database migration, dependency change, product image change or advertising
campaign change is required. Production verification uses public navigation only;
Purchase regression is isolated and does not create another live test order.
