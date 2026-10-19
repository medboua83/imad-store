// Hosted delivery is a separate explicit opt-in. Existing deployments remain inert.
const runtimeKey = Symbol.for("imad.hostedCrmWorker");
function startHostedCrmWorker({ env = process.env, tick, intervalMs = 15000 } = {}) {
  const cutoff = env.DESKCOMM_OUTBOX_MIN_CREATED_AT;
  const validCutoff = typeof cutoff === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cutoff) && Number.isFinite(Date.parse(cutoff)) && new Date(cutoff).toISOString() === cutoff;
  if (env.DESKCOMM_HOSTED_DELIVERY_ENABLED !== "true" || env.DESKCOMM_OUTBOX_WORKER_ENABLED !== "true" || !validCutoff) return async () => {};
  if (globalThis[runtimeKey]) throw new Error("Hosted CRM scheduler already registered");
  const run = tick || require("../backend/dist/lib/deskcomm-outbox.js").processDeskcommOutbox;
  let pending, stopped = false;
  const state = { scheduled: true };
  globalThis[runtimeKey] = state;
  const timer = setInterval(() => {
    if (stopped || pending) return;
    pending = Promise.resolve().then(run).catch(() => console.error("CRM worker cycle failed")).finally(() => { pending = undefined; });
  }, intervalMs);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await pending;
    if (globalThis[runtimeKey] === state) delete globalThis[runtimeKey];
  };
}
module.exports = { startHostedCrmWorker };
