const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
test('Browser headers protect all Next routes without removing required photo and Meta sources', async () => {
    const { default: config } = await import(pathToFileURL(path.resolve(__dirname,'../apps/web/next.config.mjs')));
    const rules = await config.headers();
    assert.equal(rules[0].source,'/:path*');
    const h = Object.fromEntries(rules[0].headers.map(({key,value}) => [key.toLowerCase(),value]));
    assert.equal(h['x-frame-options'],'DENY'); assert.equal(h['x-content-type-options'],'nosniff');
    assert.match(h['strict-transport-security'],/max-age=31536000/);
    assert.match(h['content-security-policy'],/frame-ancestors 'none'/);
    assert.match(h['content-security-policy'],/object-src 'none'/);
    assert.match(h['content-security-policy'],/form-action 'self'/);
    assert.match(h['content-security-policy'],/https:\/\/connect.facebook.net/);
    assert.match(h['content-security-policy'],/https:\/\/res.cloudinary.com/);
    assert.doesNotMatch(h['content-security-policy'],/unsafe-eval|\*/);
});
