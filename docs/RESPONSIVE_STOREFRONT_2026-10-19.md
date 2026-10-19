# Professional responsive storefront — 2026-10-19

The previous public home referenced missing `/images/hero-1.png`, mobile product cards occupied an entire row, and the always-visible filter form pushed the catalogue below the first screen. This change strengthens the existing ivory/forest identity and self-hosted Arabic typography instead of introducing another UI framework.

## Presentation and navigation

- Rounded editorial hero with a real catalogue product, price link and secondary detail image. The known missing legacy hero default falls back to an in-stock product; a custom configured hero remains authoritative. No product, image setting or commercial text is changed in the database.
- Uncropped catalogue photography, consistent card borders, clearer prices and two columns on phones. Category navigation scrolls within its own rail; it does not widen the document.
- Search and filters use native disclosure, preserving GET queries, advanced filters, active categories and results. The desktop search icon explicitly opens the search panel.
- Mobile bottom navigation provides home, catalogue, contact and cart actions with the existing cart count. Product pages instead show an accessible purchase bar; checkout has no navigation dock.
- Product gallery supports full-image viewing, optional thumbnails and a native zoom dialog. Quantity buttons retain existing stock limits. Product details show payment and policy guidance without invented shipping promises.
- Existing WhatsApp, Instagram, Facebook and TikTok destinations remain in the footer. Administration remains outside the scoped store shell.

## Verification

- Complete production build and TypeScript pass. Frontend lint passes.
- Isolated production frontend on port 3102 uses the public quickydev.com API for read-only catalogue data. It does not start a backend or CRM worker.
- Browser checks: home, catalogue and product at 320, 390, 768 and 1280 CSS px. Document widths are 316, 386, 764 and 1276 respectively (the remaining 4 px are the scrollbar); no horizontal document overflow. Mobile grids contain two equal columns.
- At 390 px: photo zoom opens and Escape restores focus to its trigger; mobile menu opens/closes; quantity increases to 2; cart shows 398 MAD products + 30 MAD delivery = 428 MAD. The temporary cart entry was removed. No checkout submitted, order created or CRM webhook sent.
- Searching `abaya` returns one matching product. Existing social links are present. Empty and single-image gallery states are supported; real current product pages have one image each, so multi-image navigation is not claimed as a live catalogue test.

No database schema, order, stock, CRM settings or delivery rules are changed. Browser responsive emulation is not a physical-device certification. Deployment verification is recorded separately after publication. Rollback consists of redeploying the previous release; no data rollback is needed.
