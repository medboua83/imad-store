// The database setting defaults OFF; running this timer never activates the integration.
const runtimeKey = Symbol.for("imad.hostedOlivraisonWorker");
const { CARRIER_WORKER_INTERVAL_MS, CARRIER_WORKER_BATCH_SIZE } = require("@imad-store/shared");
function startHostedOlivraisonWorker({ tick, intervalMs = CARRIER_WORKER_INTERVAL_MS } = {}) {
    if (globalThis[runtimeKey]) throw new Error("Olivraison scheduler already registered");
    const run = tick || require("../backend/dist/lib/olivraison.js").processOlivraisonQueue;
    let pending,
        stopped = false;
    const state = {};
    globalThis[runtimeKey] = state;
    const timer = setInterval(() => {
        if (stopped || pending) return;
        pending = Promise.resolve()
            .then(async () => {
                for (let n = 0; n < CARRIER_WORKER_BATCH_SIZE && !stopped; n++) {
                    if ((await run()) !== true) break;
                }
            })
            .catch(() => console.error("Olivraison worker cycle failed"))
            .finally(() => {
                pending = undefined;
            });
    }, intervalMs);
    timer.unref();
    return async () => {
        stopped = true;
        clearInterval(timer);
        await pending;
        if (globalThis[runtimeKey] === state) delete globalThis[runtimeKey];
    };
}
module.exports = { startHostedOlivraisonWorker };
