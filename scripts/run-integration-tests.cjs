const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const name = `imad_ci_${randomBytes(8).toString("hex")}`;
const env = {
    ...process.env,
    NODE_ENV: "test",
    INTEGRATION_TEST_MODE: "true",
    DATABASE_URL: `mongodb://127.0.0.1:27017/${name}?replicaSet=rs0`,
    TEST_DATABASE_NAME: name,
    JWT_SECRET: "isolated-test-secret-only",
    JWT_REFRESH_SECRET: "isolated-refresh-only",
    DESKCOMM_ENCRYPTION_KEY: "ab".repeat(32),
    DESKCOMM_ALLOW_HTTP_DEV: "true",
    DESKCOMM_OUTBOX_WORKER_ENABLED: "true",
    DESKCOMM_OUTBOX_MIN_CREATED_AT: new Date().toISOString(),
    TELEGRAM_WEBHOOK_SECRET: "isolated-telegram-secret",
    UPLOAD_DIR: path.resolve(".test-runtime", name, "uploads"),
};
for (const key of Object.keys(env))
    if (/^(GOOGLE_|TELEGRAM_BOT_|SMTP_|RESEND_|STRIPE_)/.test(key)) delete env[key];
const result = spawnSync(
    process.execPath,
    [
        "--import",
        "tsx",
        "--test",
        "tests/integration.test.ts",
        "tests/cart.test.ts",
        "tests/admin-summary.test.ts",
        "tests/admin-products.test.ts",
    ],
    { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
