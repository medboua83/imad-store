const path = require("node:path");

async function startHostedServer() {
  // Passenger normally replaces the FIRST listen() with its public socket.
  // Opt out before starting the private API listener used by server rendering.
  const passenger = global.PhusionPassenger;
  if (passenger) passenger.configure({ autoInstall: false });

  require("dotenv/config");

  for (const key of ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"]) {
    if (!process.env[key]) throw new Error(`Missing required configuration: ${key}`);
  }
  const { createServer } = require("node:http");
  const next = require("next");
  console.log("Hosted startup: loading the compiled API.");
  const { app: api } = require("../backend/dist/app.js");
  const { prisma } = require("../backend/dist/lib/prisma.js");
  const privateServer = createServer(api);
  const publicServer = createServer();
  let web;
  const listen = (server, ...args) => new Promise((resolve, reject) => {
    const failed = (error) => reject(error);
    server.once("error", failed);
    server.listen(...args, () => { server.removeListener("error", failed); resolve(); });
  });
  const closeServer = (server) => new Promise((resolve) => {
    if (!server.listening) return resolve();
    server.close(resolve);
    server.closeIdleConnections?.();
  });
  const close = async () => {
    await Promise.all([closeServer(publicServer), closeServer(privateServer)]);
    await web?.close();
    await prisma.$disconnect();
  };
  try {
    // No fixed private port: separate Passenger processes cannot collide.
    await listen(privateServer, 0, "127.0.0.1");
    process.env.API_UPSTREAM_URL = `http://127.0.0.1:${privateServer.address().port}`;
    console.log("Hosted startup: preparing the storefront.");
    web = next({ dev: false, dir: path.resolve(__dirname, "../apps/web"), httpServer: publicServer });
    await web.prepare();
    const handle = web.getRequestHandler();
    publicServer.on("request", (req, res) => {
      const pathname = (req.url || "/").split("?")[0];
      if (/^\/(api|uploads)(\/|$)/.test(pathname) || pathname === "/health") {
        api(req, res);
      } else {
        handle(req, res).catch(() => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
      }
    });
    if (passenger) await listen(publicServer, "passenger");
    else await listen(publicServer, Number(process.env.PORT || 3000), process.env.HOSTNAME || "0.0.0.0");
    console.log("Imad Store ready: storefront and API share the public listener; background workers disabled.");
    return { publicServer, privateServer, close };
  } catch (error) {
    await close();
    throw error;
  }
}

module.exports = { startHostedServer };
