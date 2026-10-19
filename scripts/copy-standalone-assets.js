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

const WEB_DIR = path.join(__dirname, "..", "apps", "web");
const STANDALONE = path.join(WEB_DIR, ".next", "standalone", "apps", "web");
const STATIC_SRC = path.join(WEB_DIR, ".next", "static");
const STATIC_DST = path.join(STANDALONE, ".next", "static");
const PUBLIC_SRC = path.join(WEB_DIR, "public");
const PUBLIC_DST = path.join(STANDALONE, "public");

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

// Publicly published images seed the persistent directory in both hosting modes.
const { resolveUploadDirectory, seedPublishedUploads } = require("./upload-storage.cjs");
const projectRoot = path.resolve(__dirname, "..");
seedPublishedUploads(projectRoot, resolveUploadDirectory(projectRoot));

if (!fs.existsSync(STANDALONE)) {
    console.log("ℹ️  Standalone output not found — skipping asset copy (dev mode?).");
    process.exit(0);
}

console.log("📦 Copying .next/static → standalone...");
copyDir(STATIC_SRC, STATIC_DST);

console.log("📦 Copying public/ → standalone...");
copyDir(PUBLIC_SRC, PUBLIC_DST);

console.log("✅ Standalone assets ready.");
