# Storefront colour and mobile contact fixes — 17 November 2026

These source changes reproduce the application files deployed in `priority-colours-20261117`, based on the tree of `944b39ac63a6` (also the tree of the Master merge `168afe9`). The fourteen application/test files were compared with the deployed SHA256 manifest before integration. Deployment reports, archives, environment files and customer data remain outside Git.

- Gallery navigation selects a purchasable variant only when the recorded image-to-colour association is unique. It retains the current size when available. General/shared images display a clarification; missing mappings are not invented or saved. A failed selected image cannot silently display another colour.
- Colour labels are grouped without merging SKUs, quantities or raw colour values. Beige spelling variants are normalized for display. A bounded group filter matches available colour and size on the same SKU. Exact-colour URLs retain their meaning. Product cards and product-page entry understand the same grouped filter.
- Mobile WhatsApp uses the existing contact position in the bottom navigation instead of covering product cards. The general contact page remains in the menu, footer and desktop navigation. The desktop floating contact is unchanged.

## Validation

The deployed candidate passed shared/backend/Next compilation and type checks, two unit tests and 37 targeted browser tests at 320/390/1440 pixels. A read-only check against the real catalogue passed 35 colour/size combinations and rejected three malformed group filters. Four public API responses and the environment checksum remained unchanged. Eight public static assets matched the final build. No real order was submitted.

The targeted browser tests cover gallery controls, mapped and unmapped photos, unavailable photo fallbacks, cart persistence, grouped filter navigation, card photos/options/availability, zoom, size discovery and mobile contact navigation. The unit test is included in the normal integration-test runner. Full repository CI remains a separate check of this Git integration.

The VPS uses a combined build. `playwright.priority.config.ts` and `tests/ui/priority-test-server.cjs` allow its already-built frontend to use only the isolated fixture API, including browser API requests. Standard CI continues to use its existing standalone build and default Playwright configuration.

```sh
node --import tsx --test tests/priority-colour-fixes.test.ts
npx playwright test tests/ui/priority-colour-fixes.spec.ts
# For an existing combined build, with no live API credentials:
IMAD_HOSTING_MODE=standalone npx playwright test -c playwright.priority.config.ts tests/ui/priority-colour-fixes.spec.ts
```

The first full CI run passed 333 browser scenarios and exposed four delivery-error regressions: a new settings-query observer in the mobile menu changed the retry timing used by the basket. The menu now receives the already-resolved WhatsApp URL from its layout instead of subscribing to settings again. Existing delivery-error assertions are retained. This follow-up changes only the two layout components beyond the initial deployed manifest and requires its own CI/deployment verification.

No schema, merchant settings, product data, npm dependencies or lockfile changes are required. Missing photo-colour mappings still require a verified merchant association.
