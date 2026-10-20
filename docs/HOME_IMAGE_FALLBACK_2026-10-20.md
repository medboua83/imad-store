# Missing cover photos: homepage and categories

A newly selected Saboliya cover `/uploads/a45365068cdc5b3473c3d73b66a2f2cd7d963f32610625b266e9f8c54aba9eaa.webp` returns 404. The same product still has the recovered `/uploads/3acee980f2b69333eac269c8a0a5eba5acda4467ae26c86bd61fa57e0c992315.webp` available. Product cards and the gallery already handle failures, but the hero and custom category photo did not. Browser inspection confirmed both displayed native broken-image icons.

The homepage now shares the tested product-photo fallback component. The hero tries the configured cover and the featured product's photos; a category tries its own custom image, products in that category, then the existing bundled illustration. It never substitutes an unrelated product. Banners and cart lines also have neutral fallback behavior. Original media references remain intact; this does not recover the missing new originals or rewrite catalogue data.

The upload resolver also recognizes public_html and nested Hostinger release roots. Production should use an explicit UPLOAD_DIR pointing to the existing domain-level shared/uploads directory, so runtime working-directory variants cannot select replaceable release storage. Verify an unbundled admin upload survives a subsequent deployment; bundled-image seeding alone is not a sufficient production durability test.

Validation: frontend lint/build; storage regression tests include build, current, public_html and nested release paths; category source tests verify correct product preference, duplicate removal and legacy-placeholder rejection. Read-only local browser preview with current public data verifies all six hero/category images decode, including the two previously broken locations. No production order or CRM action is required.
