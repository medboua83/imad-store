#!/usr/bin/env node
/**
 * Hostinger Node.js Application Entrypoint
 * ─────────────────────────────────────────
 * Boots the Next.js standalone server produced by `output: 'standalone'`.
 * Hostinger sets process.env.PORT automatically; we fall back to 3000 locally.
 *
 * Usage (Hostinger Entry File field): server.js
 */

const path = require("path");

// Point to the compiled standalone server inside .next/standalone
const standaloneServer = path.join(
  __dirname,
  "apps",
  "web",
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js"
);

process.env.PORT = process.env.PORT || "3000";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

if (process.env.IMAD_HOSTING_MODE === "combined") {
  require("./scripts/hosted-server.cjs").startHostedServer().then((runtime) => {
    for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => {
      runtime.close().finally(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }).catch((error) => {
    // Never print configuration values or database connection strings.
    console.error("Hosted startup failed. Check the build and required server configuration.");
    if (/^[A-Za-z0-9_]+$/.test(error?.name || "")) console.error(`Startup type: ${error.name}`);
    if (/^[A-Z_0-9]+$/.test(error?.code || "")) console.error(`Startup code: ${error.code}`);
    process.exit(1);
  });
} else {
  require(standaloneServer);
}
