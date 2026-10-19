# Generated demonstration product images

Five fictional product visuals were created with the built-in imagegen tool on 2026-10-19. See prompts.json for the full generation instructions and manifest.json for product-slug mapping, SHA-256 checksums and optimized byte sizes. These are demonstration illustrations, not photographs of actual merchandise.

The owner explicitly authorized publication on quickydev.com. The images were uploaded through the authenticated product editor and replaced the No Image placeholders on the five existing products. Prices, stock, variants, status and categories were preserved. No orders or CRM events were created.

Optimized WebP source assets live in apps/web/public/images/catalogue-demo/. The deployment asset-copy script restores those five content-addressed files into backend/uploads/ before its standalone-specific step, including combined hosting builds with no standalone output. Existing unrelated uploads are not deleted. No database seeding or changes occur during build.

This guarantees persistence only for these five bundled demonstration images. Future administrator uploads still require a persistent UPLOAD_DIR or external media storage.

Rollback: restore the image list on each product through the editor. The previous images were the public placehold.co No Image placeholders. Removing an image from a product does not delete its uploaded file.
