// Reuse the site's wordmark alpha mask and gold palette. Original artwork stays untouched.
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
(async () => {
  const folder = path.resolve(__dirname, "../apps/web/public/images/brand");
  const mask = await sharp(await readFile(path.join(folder, "imad-mode-selected-v1.webp")))
    .resize(720, 330).png().toBuffer();
  const gradient = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="330"><defs><linearGradient id="gold" x2="1" y2="1"><stop stop-color="#78551f"/><stop offset=".48" stop-color="#b68c42"/><stop offset="1" stop-color="#806025"/></linearGradient></defs><rect width="720" height="330" fill="url(#gold)"/></svg>`;
  const wordmark = await sharp(Buffer.from(gradient)).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#fcfaf6"/>
    <rect x="32" y="32" width="1136" height="566" rx="12" fill="none" stroke="#b38a43" stroke-width="2"/>
    <rect x="44" y="44" width="1112" height="542" rx="6" fill="none" stroke="#e3d7c1"/>
    <path d="M465 525H575M625 525H735" stroke="#b38a43"/>
    <path d="M600 517L608 525L600 533L592 525Z" fill="#b38a43"/>
  </svg>`;
  await sharp(Buffer.from(svg)).composite([{ input: wordmark, left: 240, top: 142 }]).png().toFile(path.join(folder, "imad-share-gold-v1.png"));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
