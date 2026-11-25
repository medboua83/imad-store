const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const name = `imad_ci_${randomBytes(8).toString("hex")}`;
const { databaseUrl, createDatabase, dropDatabase } = require("./test-postgres.cjs");
const env = {
    ...process.env,
    NODE_ENV: "test",
    INTEGRATION_TEST_MODE: "true",
    DATABASE_URL: databaseUrl(name),
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
    if (/^(GOOGLE_|TELEGRAM_BOT_|SMTP_|RESEND_|STRIPE_|STORE_INSTANCE_ID$|STORE_SETUP_MODE$|STORE_DISPLAY_NAME$|CRM_COMPANY_ID$|DESKCOMM_STATUS_)/.test(key)) delete env[key];
(async () => {
await createDatabase(name);
try {
const result = spawnSync(
    process.execPath,
    [
        "--import",
        "tsx",
        "--test",
        "tests/integration.test.ts",
        "tests/cart.test.ts",
        "tests/catalog-return.test.ts",
        "tests/priority-colour-fixes.test.ts",
        "tests/order-whatsapp.test.ts",
        "tests/order-rate-limit.test.ts",
        "tests/order-history-search.test.ts",
        "tests/customer-order-history.test.ts",
        "tests/carrier-manual-approval.test.ts",
        "tests/team-access-gmail.test.ts",
        "tests/admin-browser-session.test.ts",
        "tests/admin-mfa.test.ts",
        "tests/admin-browser-identity.test.ts",
        "tests/admin-session-retry.test.ts",
        "tests/pos.test.ts",
        "tests/pos-cash.test.ts",
        "tests/pos-returns.test.ts",
        "tests/pos-return-draft.test.ts",
        "tests/pos-draft.test.ts",
        "tests/pos-cash-draft.test.ts",
        "tests/shipping.test.ts",
        "tests/store-contact.test.ts",
        "tests/store-branding.test.ts",
        "tests/quantity-pricing.test.ts",
        "tests/share-metadata.test.ts",
        "tests/product-information.test.ts",
        "tests/olivraison-api.test.ts",
        "tests/meta-pixel.test.ts",
        "tests/meta-domain-verification.test.ts",
        "tests/analytics-client.test.ts",
        "tests/analytics-period.test.ts",
        "tests/category-visuals.test.ts",
        "tests/store-template.test.ts",
        "tests/resale-installation.test.ts",
        "tests/deskcomm-form.test.ts",
        "tests/checkout-assistance.test.ts",
        "tests/admin-summary.test.ts",
        "tests/admin-locale.test.ts",
        "tests/admin-products.test.ts",
    ],
    { env, stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
} finally { await dropDatabase(name); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
