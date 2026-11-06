# PostgreSQL and generic x86-64 hosting

The current schema targets PostgreSQL 16 through the existing Prisma 5 client. This is an installation on a fresh database, not an in-place conversion of a live MongoDB database. Original snapshots and the previous MongoDB revision must be kept separately. No command history, private credentials or stock is inferred from a public catalogue snapshot.

## Database

Apply the versioned SQL migration with `npm --prefix backend run prisma:migrate` or `store:run <private profile> migrate`. Never use reset or db push on a live database. The migration installs unique constraints, including nullable order idempotency keys, and foreign keys. Commerce identifiers retain their 24-hexadecimal API format, while existing IDs can be imported unchanged. Transaction isolation is Serializable; the existing order and callback retry paths handle conflicts. SQL null replaces absent MongoDB fields. Literal searches escape PostgreSQL ILIKE wildcard characters.

Use a database and runtime role dedicated to the installation. Keep PostgreSQL bound to loopback, with a separate migration owner and no superuser/createdb/createrole privileges for the application. Grant the runtime role DML on the migrated tables. For future migrations, configure default privileges for that owner. Do not copy a populated store to initialize another CRM company. The original store's CRM identity and secrets must be configured from verified sources; never invent company UUIDs.

## Statistics

Analytics is a typed SQL model, indexed by scope/period, scope/session and expiry. Event IDs remain hashes with unique insert-on-conflict semantics. SQL aggregates stay scoped by the server identity; timestamps and native bigint counts are converted before the public response. Status ranks only move forward. Purge expired events with `node scripts/prune-analytics.cjs` at least hourly using the same private application environment; request-time cleanup remains a fallback. No analytics event contains customer contact data.

## Images on CPUs without SSE4.2

Sharp's standard Linux x64 prebuilt binaries cannot run on this host. Keep the supported Sharp version, compile official libvips 8.18.7 for generic x86-64 (without Highway/ORC), then compile Sharp against that installation. Official archive: https://github.com/libvips/libvips/releases/download/v8.18.7/vips-8.18.7.tar.xz. SHA-256: `5baaead3b0bb20ffdb9e9ff09aa9fda08620923df77b63b436654cb5e0b3bf94` (official release asset digest).

Example build (after installing the required development libraries): `CFLAGS="-O2 -march=x86-64 -mtune=generic" CXXFLAGS="-O2 -march=x86-64 -mtune=generic" meson setup build --prefix=/opt/imadmode-vips-8.18.7 --libdir=lib --buildtype=release -Dhighway=disabled -Dorc=disabled -Dintrospection=disabled -Dexamples=false -Dmodules=disabled -Dheif=enabled -Djpeg=enabled -Dpng=enabled -Dwebp=enabled`, followed by `meson compile -C build -j 4` and an administrative `meson install -C build`.

Use an isolated prefix such as `/opt/imadmode-vips-8.18.7`, register its lib directory with ldconfig, then run `IMAD_LIBVIPS_PREFIX=/opt/imadmode-vips-8.18.7 npm run build:images:native` after every fresh npm ci on such hosts. The command tests PNG/JPEG/WebP decoding, resize and WebP encoding. It never rewrites stored photographs. This is unnecessary on machines compatible with the standard Sharp binaries. Compile as the unprivileged deployment user; only installation of the library needs administration.

Keep persistent uploads outside releases, with hashed immutable filenames. Source files, shared uploads, private configuration and backups must be separate. Verify uploads survive a process restart and release switch.

## Runtime and tests

Node 22, combined Next/Express listener bound to loopback; nginx is the HTTPS entry point. If `IMAD_TRUST_LOOPBACK_PROXY=true`, nginx must overwrite X-Forwarded-For with the actual remote address. Never expose that private listener. Each CRM/carrier connection remains disabled until its destination and keys are verified; no historical replay or outbound test is implied by deployment.

`npm test` creates random `imad_ci_<16 hex>` PostgreSQL databases and applies migrations. `IMAD_TEST_POSTGRES_URL` is a dedicated local test role with CREATEDB and database /postgres, separate from the application. The runner never derives administrative access from DATABASE_URL and only drops guarded disposable names. Run the UI tests, installer tests, production build and all three hosted listener tests in addition to integration tests.

The recovered public catalogue is restored only after explicit approval, as drafts with zero stock. Photos and product/variant IDs are preserved. Operators review stock, promotions and integrations before enabling sales.
