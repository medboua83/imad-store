import base from "./playwright.config";
export default {
    ...base,
    webServer: [
        ...(Array.isArray(base.webServer) ? base.webServer.slice(0, 1) : []),
        { command: "node tests/ui/priority-test-server.cjs", url: "http://127.0.0.1:3131/checkout",
          reuseExistingServer: false, timeout: 90_000,
          env: { NEXT_PUBLIC_API_URL: "/api", NODE_ENV: "production", IMAD_HOSTING_MODE: "standalone", API_UPSTREAM_URL: "http://127.0.0.1:4000" } },
    ],
};
