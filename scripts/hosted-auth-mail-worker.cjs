const key = Symbol.for("imad.accessMailWorker");
function startHostedAuthMailWorker({ env = process.env, tick, intervalMs = 10000 } = {}) {
  if (env.IMAD_AUTH_MAIL_WORKER_DISABLED === "true" || env.NODE_ENV === "test") return async () => {};
  if (globalThis[key]) throw new Error("Access mail worker already registered");
  const run = tick || require("../backend/dist/lib/password-reset.js").processAccessMail;
  let pending, stopped = false;
  const state = {}; globalThis[key] = state;
  const timer = setInterval(() => {
    if (pending || stopped) return;
    pending = Promise.resolve().then(run).catch(() => console.error("Access mail worker unavailable")).finally(() => { pending = undefined; });
  }, intervalMs);
  timer.unref();
  return async () => {
    stopped = true; clearInterval(timer); await pending;
    if (globalThis[key] === state) delete globalThis[key];
  };
}
module.exports = { startHostedAuthMailWorker };
