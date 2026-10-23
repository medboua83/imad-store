import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "tests/ui",
    timeout: 30_000,
    workers: 1,
    use: { baseURL: "http://127.0.0.1:3131", trace: "retain-on-failure" },
    webServer: [{
        command: "node tests/ui/store-fixture.cjs",
        url: "http://127.0.0.1:4005/api/settings",
        reuseExistingServer: false,
    }, {
        command: "npm --prefix apps/web run start -- --hostname 127.0.0.1 --port 3131",
        url: "http://127.0.0.1:3131/checkout",
        reuseExistingServer: false,
        timeout: 90_000,
        env: { NEXT_PUBLIC_API_URL: "/api", NODE_ENV: "production", API_UPSTREAM_URL: "http://127.0.0.1:4005" },
    }],
});
