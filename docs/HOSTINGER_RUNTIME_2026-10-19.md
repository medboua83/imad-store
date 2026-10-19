# Hostinger: storefront and API on one public listener

The former root entrypoint started only Next standalone. Server rendering and
same-origin rewrites still targeted a separate API at localhost:4000; Hostinger
runtime logs showed connection refusals for catalogue/settings and login.

## Configuration

Keep framework Other, repository root `./`, build command `npm run build`, no
output directory, entry `server.js`, Node 22. Set `IMAD_HOSTING_MODE=combined` at
both build and runtime. Use the site's own `/api` as `NEXT_PUBLIC_API_URL`.
Preserve the existing DATABASE_URL, JWT_SECRET and JWT_REFRESH_SECRET. They are
required; there is no environment-password authentication bypass or startup seed.

The build generates Prisma and compiles the backend as well as Next. If a host
has omitted build dependencies, the combined build restores them with
`npm ci --include=dev` using the existing lockfile. No dependency versions change.
The combined Next build uses the regular output, as required by the official
custom-server API. Local standalone builds remain available without the flag.

The combined entrypoint binds exactly one public HTTP/TCP listener for Next and
Express, including on hosting adapters that intercept net.Server.listen. Public
server-rendered pages call shared read-only backend services in the same process.
The same services implement the HTTP public endpoints, preserving publication
filters, query validation, JSON serialization and 404 behavior. The internal
reader has an explicit public-path whitelist; it exposes no orders, accounts,
admin catalogue, draft content or mutation operation. Server-only code retains
the eight-second read timeout and request-level React memoization.

Browser API and upload requests go through the existing Express routes on that
same public listener. JWT checks, publication rules and rate limits remain in
force. There is no private port, second server, startup data seed or public-URL
loopback. Ordinary local standalone mode retains its existing HTTP API client.

References: [Passenger reverse port binding](https://www.phusionpassenger.com/docs/advanced_guides/in_depth/node/reverse_port_binding.html),
[Next custom servers](https://nextjs.org/docs/app/guides/custom-server).

Actual Hostinger logs also exposed Prisma 5's failure to parse a host DNS resolver
option when opening a MongoDB SRV URL. Combined startup expands that URL's SRV/TXT
records with Node's DNS API before importing Prisma. It retains encoded credentials,
database, query options and implicit TLS, validates target parent domains, and
rejects unsafe/ambiguous TXT options. The stored Hostinger secret is unchanged;
the standard seed-list URL exists only in process memory. Discovery repeats on
process restart, while the MongoDB replica-set driver handles topology updates.
Special SRV host-selection/service-name overrides are rejected rather than guessed.
See [MongoDB DNS seed-list specification](https://github.com/mongodb/specifications/blob/master/source/initial-dns-seedlist-discovery/initial-dns-seedlist-discovery.md).

## Operational limits and rollback

The hosted entrypoint imports `backend/dist/app.js`, never the worker-bearing
`index.js`: it does not start scheduled Sheets/CRM delivery or replay historical
outbox records. Those workers require a separately configured service with the
historical cutoff preserved. Request-triggered integrations keep their existing
behavior. No order is submitted as part of production verification.

Uploaded files need a persistent absolute `UPLOAD_DIR` outside versioned build
directories, or an external storage service, before relying on uploads across
deployments. Existing image data is not copied from the local development DB.
There is no database/schema migration or product publication in this repair.

For rollback, select the previous successful Hostinger deployment and restore
its original environment configuration (remove `IMAD_HOSTING_MODE`). Its known
missing-API limitation will return. Keep current database credentials unchanged.

## Validation

`npm run check` verifies the original standalone build. For combined hosting:
`IMAD_HOSTING_MODE=combined NEXT_PUBLIC_API_URL=/api npm run build`, then
`npm run test:hosted`. The latter runs three separate processes with a disposable,
strictly guarded MongoDB test database: real TCP, a Passenger binding-contract
simulation and a LiteSpeed simulation that rejects any second net.Server listener. It checks public SSR/catalogue, login, protected admin access,
authenticated photos, static assets and absence of orders/outbox writes. Actual
Passenger/platform compatibility must also be checked after deployment.
