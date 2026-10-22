const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startHostedOlivraisonWorker } = require('../scripts/hosted-olivraison-worker.cjs');
test('Carrier scheduler never overlaps, refuses a second registration and waits during shutdown', async () => {
    let active = 0, max = 0, ticks = 0;
    const stop = startHostedOlivraisonWorker({ intervalMs: 5, tick: async () => {
        active++; max = Math.max(max, active); ticks++;
        await new Promise(r => setTimeout(r, 20)); active--;
    } });
    assert.throws(() => startHostedOlivraisonWorker({ tick: async () => {} }), /already registered/);
    await new Promise(r => setTimeout(r, 55)); await stop();
    assert.equal(active, 0); assert.equal(max, 1); assert.ok(ticks >= 1);
    const second = startHostedOlivraisonWorker({ tick: async () => {} }); await second();
});
