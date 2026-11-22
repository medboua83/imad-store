const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startHostedAuthMailWorker } = require('../scripts/hosted-auth-mail-worker.cjs');
test('Access mail scheduling is inert in tests or explicit preflight mode', async () => {
  let calls = 0;
  for (const env of [{ NODE_ENV: 'test' }, { IMAD_AUTH_MAIL_WORKER_DISABLED: 'true' }]) {
    const close = startHostedAuthMailWorker({ env, tick: () => { calls++; }, intervalMs: 5 });
    await new Promise(r => setTimeout(r, 20)); await close();
  }
  assert.equal(calls, 0);
});
test('The access mail worker cannot overlap cycles, rejects duplicate schedulers and stops cleanly', async () => {
  let resolveStarted, release, calls = 0;
  const keepAlive = setTimeout(() => {}, 2000);
  const started = new Promise(r => { resolveStarted = r; }), blocked = new Promise(r => { release = r; });
  const close = startHostedAuthMailWorker({ env: { NODE_ENV: 'production' }, intervalMs: 5, tick: async () => { calls++; resolveStarted(); await blocked; } });
  try {
    await started;
    assert.throws(() => startHostedAuthMailWorker({ env: {}, tick: () => {} }), /already registered/);
    await new Promise(r => setTimeout(r, 30)); assert.equal(calls, 1);
    release(); await close(); await new Promise(r => setTimeout(r, 20)); assert.equal(calls, 1);
    const next = startHostedAuthMailWorker({ env: {}, tick: () => {}, intervalMs: 50 }); await next();
  } finally { release(); await close(); clearTimeout(keepAlive); }
});
