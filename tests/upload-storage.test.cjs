const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { resolveUploadDirectory, seedPublishedUploads } = require('../scripts/upload-storage.cjs');
test('Hostinger builds and successive releases share media, separate domains do not', () => {
  const domain = '/home/account/domains/shop.example';
  for (const release of ['source/repository', 'versions/first', 'versions/second', 'current'])
    assert.equal(resolveUploadDirectory(`${domain}/hbuilds/${release}`, ''), `${domain}/shared/uploads`);
  assert.notEqual(resolveUploadDirectory('/home/account/domains/other.example/hbuilds/current', ''), `${domain}/shared/uploads`);
  assert.equal(resolveUploadDirectory('/tmp/local-store', ''), '/tmp/local-store/backend/uploads');
  assert.equal(resolveUploadDirectory(`${domain}/hbuilds/current`, '/data/media'), '/data/media');
});
test('A new release retains unbundled uploads; recovery never overwrites existing media', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'imad-media-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const first = path.join(temp, 'domains/shop.example/hbuilds/versions/first');
  const second = path.join(temp, 'domains/shop.example/hbuilds/versions/second');
  const source = path.join(first, 'apps/web/public/images/catalogue-published');
  fs.mkdirSync(source, { recursive: true });
  const original = Buffer.from('published recovery fixture');
  const file = createHash('sha256').update(original).digest('hex') + '.webp';
  fs.writeFileSync(path.join(source, file), original);
  fs.writeFileSync(path.join(source, 'ignore.txt'), 'not media');
  const directory = resolveUploadDirectory(first, '');
  assert.equal(seedPublishedUploads(first, directory), 1);
  fs.writeFileSync(path.join(directory, 'future-upload.webp'), 'new admin upload');
  fs.rmSync(first, { recursive: true });
  assert.equal(seedPublishedUploads(second, resolveUploadDirectory(second, '')), 0);
  assert.deepEqual(fs.readFileSync(path.join(directory, file)), original);
  assert.equal(fs.readFileSync(path.join(directory, 'future-upload.webp'), 'utf8'), 'new admin upload');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, file), original);
  fs.writeFileSync(path.join(directory, file), 'existing media');
  assert.equal(seedPublishedUploads(first, directory), 0);
  assert.equal(fs.readFileSync(path.join(directory, file), 'utf8'), 'existing media');
  fs.writeFileSync(path.join(source, file), 'corrupted bundled asset');
  assert.throws(() => seedPublishedUploads(first, directory), /checksum mismatch/);
});
test('Recovered public product photo is the exact original', () => {
 const hash = '3acee980f2b69333eac269c8a0a5eba5acda4467ae26c86bd61fa57e0c992315';
 const photo = fs.readFileSync(path.join(__dirname, '../apps/web/public/images/catalogue-published', hash + '.webp'));
 assert.equal(createHash('sha256').update(photo).digest('hex'), hash);
});
