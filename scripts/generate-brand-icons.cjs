// Raster derivatives of the code-native monogram. No fonts or remote assets.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const app = path.resolve(__dirname, '../apps/web/app');
const output = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (output) fs.mkdirSync(output, { recursive: true });
const svg = fs.readFileSync(path.join(app, 'icon.svg'));

async function main() {
  const sizes = [16, 32, 48, 256];
  const frames = [];
  for (const size of sizes) {
    const png = await sharp(svg).resize(size, size).png().toBuffer();
    if (output) fs.writeFileSync(path.join(output, `favicon-${size}.png`), png);
    if (size === 256) { frames.push(png); continue; }
    const pixels = await sharp(svg).resize(size, size).ensureAlpha().raw().toBuffer();
    const maskStride = Math.ceil(size / 32) * 4;
    const dib = Buffer.alloc(40 + size * size * 4 + maskStride * size);
    dib.writeUInt32LE(40, 0);
    dib.writeInt32LE(size, 4);
    dib.writeInt32LE(size * 2, 8);
    dib.writeUInt16LE(1, 12);
    dib.writeUInt16LE(32, 14);
    dib.writeUInt32LE(size * size * 4, 20);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const source = (y * size + x) * 4;
      const target = 40 + ((size - y - 1) * size + x) * 4;
      dib[target] = pixels[source + 2];
      dib[target + 1] = pixels[source + 1];
      dib[target + 2] = pixels[source];
      dib[target + 3] = pixels[source + 3];
    }
    frames.push(dib);
  }
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const start = 6 + i * 16;
    header[start] = header[start + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, start + 4);
    header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(frames[i].length, start + 8);
    header.writeUInt32LE(offset, start + 12);
    offset += frames[i].length;
  });
  fs.writeFileSync(path.join(app, 'favicon.ico'), Buffer.concat([header, ...frames]));
  await sharp(svg).resize(180, 180).png().toFile(path.join(app, 'apple-icon.png'));
  console.log('Brand icons generated: SVG, ICO (16/32/48/256) and Apple PNG (180).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
