const fs = require("node:fs");
const zlib = require("node:zlib");
(async () => {
    const origin = process.argv[2] || "http://127.0.0.1:3102";
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
        throw Error("Local production preview required");
    const results = [];
    for (const route of ["/", "/shop", "/products/preview-bag", "/admin"]) {
        let html = "",
            timings = [];
        for (let i = 0; i < 6; i++) {
            const start = performance.now();
            const response = await fetch(origin + route);
            html = await response.text();
            if (!response.ok) throw Error("Page failed " + route);
            if (i) timings.push(performance.now() - start);
        }
        const scripts = [
            ...new Set([...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1])),
        ];
        let bytes = 0,
            gzipBytes = 0;
        for (const src of scripts) {
            const body = Buffer.from(await (await fetch(new URL(src, origin))).arrayBuffer());
            bytes += body.length;
            gzipBytes += zlib.gzipSync(body).length;
        }
        const scriptBudgetGzipBytes = route === "/admin" ? 280 * 1024 : 250 * 1024;
        results.push({
            scriptBudgetGzipBytes,
            withinBudget: gzipBytes <= scriptBudgetGzipBytes,
            route,
            htmlBytes: Buffer.byteLength(html),
            scriptCount: scripts.length,
            scriptBytes: bytes,
            scriptGzipBytes: gzipBytes,
            warmResponseMedianMs: Math.round(timings.sort((a, b) => a - b)[2]),
        });
    }
    if (results.some((row) => !row.withinBudget)) process.exitCode = 1;
    console.log(
        JSON.stringify(
            {
                measuredAt: new Date().toISOString(),
                origin,
                runs: 5,
                notes: "Local unthrottled production HTTP, not browser Core Web Vitals or field measurements",
                routes: results,
            },
            null,
            2,
        ),
    );
})().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
});
