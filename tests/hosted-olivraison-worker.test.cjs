const { test } = require("node:test");
const assert = require("node:assert/strict");
const { startHostedOlivraisonWorker } = require("../scripts/hosted-olivraison-worker.cjs");
test("Carrier scheduler never overlaps, refuses a second registration and waits during shutdown", async () => {
    let active = 0,
        max = 0,
        ticks = 0;
    const stop = startHostedOlivraisonWorker({
        intervalMs: 5,
        tick: async () => {
            active++;
            max = Math.max(max, active);
            ticks++;
            await new Promise((r) => setTimeout(r, 20));
            active--;
        },
    });
    assert.throws(
        () => startHostedOlivraisonWorker({ tick: async () => {} }),
        /already registered/,
    );
    await new Promise((r) => setTimeout(r, 55));
    await stop();
    assert.equal(active, 0);
    assert.equal(max, 1);
    assert.ok(ticks >= 1);
    const second = startHostedOlivraisonWorker({ tick: async () => {} });
    await second();
});

const { setImmediate: settled } = require("node:timers/promises");
test("Default scheduler drains a bounded batch every five seconds, then stops at an empty queue", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    let calls = 0,
        remaining = 12;
    const stop = startHostedOlivraisonWorker({
        tick: async () => {
            calls++;
            return remaining-- > 0;
        },
    });
    try {
        t.mock.timers.tick(4999);
        await settled();
        assert.equal(calls, 0);
        t.mock.timers.tick(1);
        await settled();
        assert.equal(calls, 10);
        t.mock.timers.tick(5000);
        await settled();
        assert.equal(calls, 13);
        t.mock.timers.tick(5000);
        await settled();
        assert.equal(calls, 14);
    } finally {
        await stop();
    }
});
test("A slow batch stays serial across timer ticks; shutdown waits but does not drain more parcels", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    let release,
        calls = 0;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const stop = startHostedOlivraisonWorker({
        tick: async () => {
            calls++;
            await gate;
            return true;
        },
    });
    t.mock.timers.tick(5000);
    await settled();
    t.mock.timers.tick(20000);
    await settled();
    assert.equal(calls, 1);
    const stopping = stop();
    release();
    await stopping;
    assert.equal(calls, 1);
    t.mock.timers.tick(30000);
    await settled();
    assert.equal(calls, 1);
});
