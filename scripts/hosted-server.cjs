const path = require("node:path");

async function startHostedServer() {
  const passenger = global.PhusionPassenger;
  if (passenger) passenger.configure({ autoInstall: false });
  require("dotenv/config");
  for (const key of ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"]) {
    if (!process.env[key]) throw new Error(`Missing required configuration: ${key}`);
  }
  process.env.DATABASE_URL = await require("./resolve-hosted-database.cjs").resolveHostedDatabase(process.env.DATABASE_URL);
  const { createServer } = require("node:http");
  const next = require("next");
  console.log("Hosted startup: loading the compiled API.");
  const { assertStoreInstallation } = require("../backend/dist/lib/store-installation.js");
  await assertStoreInstallation();
  const { app: api } = require("../backend/dist/app.js");
  const { prisma } = require("../backend/dist/lib/prisma.js");
  const { readPublicStore } = require("../backend/dist/lib/public-store.js");
  const readerKey = Symbol.for("imad.publicStoreRead");
  globalThis[readerKey] = readPublicStore;
  const publicServer = createServer();
  let web;
  let stopCrmWorker = async () => {};
  const close = async () => {
    await stopCrmWorker();
    if (publicServer.listening) await new Promise((resolve) => {
      publicServer.close(resolve);
      publicServer.closeIdleConnections?.();
    });
    await web?.close();
    if (globalThis[readerKey] === readPublicStore) delete globalThis[readerKey];
    await prisma.$disconnect();
  };
  try {
    // Exactly one HTTP/TCP listener, including on hosts that intercept net.Server.
    // Public SSR data uses shared read-only services rather than a second server.
    console.log("Hosted startup: preparing the storefront.");
    web = next({ dev: false, dir: path.resolve(__dirname, "../apps/web"), httpServer: publicServer });
    await web.prepare();
    const handle = web.getRequestHandler();
    publicServer.on("request", (req, res) => {
      const pathname = (req.url || "/").split("?")[0];
      if (/^\/(api|uploads)(\/|$)/.test(pathname) || pathname === "/health") api(req, res);
      else handle(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });
    await new Promise((resolve, reject) => {
      publicServer.once("error", reject);
      const bound = () => { publicServer.removeListener("error", reject); resolve(); };
      if (passenger) publicServer.listen("passenger", bound);
      else publicServer.listen(Number(process.env.PORT || 3000), process.env.HOSTNAME || "0.0.0.0", bound);
    });
    stopCrmWorker = require("./hosted-crm-worker.cjs").startHostedCrmWorker();
    console.log("Imad Store ready: one public listener; CRM scheduler requires explicit hosted opt-in.");
    return { publicServer, close };
  } catch (error) {
    await close();
    throw error;
  }
}
module.exports = { startHostedServer };
