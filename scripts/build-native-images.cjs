// Opt-in native image build for hosts whose CPUs cannot run Sharp's x64-v2 binaries.
// libvips must already be installed from a verified official source by the operator.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const prefix = process.env.IMAD_LIBVIPS_PREFIX;
if (process.platform !== 'linux' || process.arch !== 'x64' || !prefix || !path.isAbsolute(prefix) || !fs.existsSync(path.join(prefix, 'lib/pkgconfig/vips-cpp.pc')))
  throw new Error('An installed Linux libvips prefix is required');
const env = { ...process.env, SHARP_FORCE_GLOBAL_LIBVIPS: 'true',
  PKG_CONFIG_PATH: [path.join(prefix, 'lib/pkgconfig'), process.env.PKG_CONFIG_PATH].filter(Boolean).join(':'),
  CFLAGS: '-O2 -march=x86-64 -mtune=generic', CXXFLAGS: '-O2 -march=x86-64 -mtune=generic',
};
const result = spawnSync('npm', ['explore', 'sharp', '--', 'npm', 'run', 'build'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const sharp = require('sharp');
(async () => {
  for (const format of ['png', 'jpeg', 'webp']) {
    const original = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#ac8537' } }).toFormat(format).toBuffer();
    const result = await sharp(original).rotate().resize({ width: 8 }).webp().toBuffer();
    const metadata = await sharp(result).metadata();
    if (metadata.width !== 8 || metadata.height !== 6 || metadata.format !== 'webp') throw new Error('Native image verification failed');
  }
  console.log('Native image processing verified: PNG/JPEG/WebP inputs, resize and WebP output.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
