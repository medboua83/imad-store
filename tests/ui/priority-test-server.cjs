// Exercise the combined production build against the isolated read-only fixture API.
const http = require("node:http");
const path = require("node:path");
const next = require("next");
const app = next({ dev: false, dir: path.resolve(__dirname, "../../apps/web"), hostname: "127.0.0.1", port: 3131 });
app.prepare().then(() => {
    const handle = app.getRequestHandler();
    http.createServer((req, res) => {
        if (!req.url.startsWith("/api/")) return handle(req, res);
        const upstream = http.request({ hostname: "127.0.0.1", port: 4000,
            path: req.url, method: req.method, headers: req.headers }, response => {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
        });
        upstream.on("error", () => { res.writeHead(502); res.end("Fixture unavailable"); });
        req.pipe(upstream);
    }).listen(3131, "127.0.0.1");
});
