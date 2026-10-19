# Product media durability

The published Saboliya gallery referenced four uploads that returned HTTP 404 after a Hostinger release. The exact first original was recovered from the browser cache and verified against its SHA-256 URL, then bundled under `apps/web/public/images/catalogue-published/`. The three other originals could not be recovered. Their database references are retained; no invented replacement views or catalogue writes are used.

`UPLOAD_DIR` remains the explicit override. When unset on Hostinger, both the build repository and every runtime release resolve to `<domain-root>/shared/uploads`, outside `hbuilds` and `public_html`. Local installations retain `backend/uploads`. Independent domains therefore have separate media directories. A custom production `UPLOAD_DIR` must also point outside release trees. Back up this persistent directory along with the database; persistence is not a backup against account deletion or disk loss.

Build and backend startup seed only explicitly published, SHA-256 checked WebP assets, without overwriting existing uploads. This repairs the original URL, including old database references. Ordinary uploads continue to use content-addressed filenames. A deployment no longer chooses a fresh upload directory.

The gallery filters failed image URLs from navigation and zoom. Product cards try subsequent photos before showing a neutral placeholder. These protections avoid broken-image icons but do not recover missing originals. No existing order, CRM integration, stock or product data is modified.

Regression coverage checks separate domains, explicit overrides, local paths, two successive releases with an unbundled upload, recovery without overwrite, corrupt asset rejection, original checksum and public hosted serving of the recovered image.
