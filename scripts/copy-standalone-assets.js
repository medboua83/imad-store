#!/usr/bin/env node
/**
 * post-build: copy-standalone-assets.js
 * ──────────────────────────────────────
 * Next.js standalone output does NOT automatically include:
 *   - .next/static  (JS chunks, CSS, etc.)
 *   - public/       (images, fonts, icons)
 *
 * This script copies them into the standalone bundle so all assets are
 * served correctly when Hostinger runs `node server.js`.
 */

const fs = require("fs");
const path = require("path");

const WEB_DIR       = path.join(__dirname, "..", "apps", "web");
const STANDALONE    = path.join(WEB_DIR, ".next", "standalone", "apps", "web");
const STATIC_SRC    = path.join(WEB_DIR, ".next", "static");
const STATIC_DST    = path.join(STANDALONE, ".next", "static");
const PUBLIC_SRC    = path.join(WEB_DIR, "public");
const PUBLIC_DST    = path.join(STANDALONE, "public");

function copyDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Source not found, skipping: ${src}`);
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// These explicitly published demo photos must survive a fresh hosted release.
// Keep their content-addressed /uploads URLs compatible with the admin uploader.
// This copies files only; it never seeds or updates the product database.
copyDir(
  path.join(PUBLIC_SRC, "images", "catalogue-demo"),
  path.join(__dirname, "..", "backend", "uploads")
);

if (!fs.existsSync(STANDALONE)) {
  console.log("ℹ️  Standalone output not found — skipping asset copy (dev mode?).");
  process.exit(0);
}

console.log("📦 Copying .next/static → standalone...");
copyDir(STATIC_SRC, STATIC_DST);

console.log("📦 Copying public/ → standalone...");
copyDir(PUBLIC_SRC, PUBLIC_DST);

console.log("✅ Standalone assets ready.");
