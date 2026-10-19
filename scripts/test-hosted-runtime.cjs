const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const name = `imad_ci_${randomBytes(8).toString("hex")}`;
const env = {
  ...process.env, NODE_ENV: "production", IMAD_HOSTING_MODE: "combined", PORT: "0", HOSTNAME: "127.0.0.1",
  DATABASE_URL: `mongodb://127.0.0.1:27017/${name}?replicaSet=rs0`, TEST_DATABASE_NAME: name,
  JWT_SECRET: "hosted-isolated-secret", JWT_REFRESH_SECRET: "hosted-isolated-refresh",
  UPLOAD_DIR: path.resolve(".test-runtime", name, "uploads"),
  DESKCOMM_OUTBOX_WORKER_ENABLED: "false",
};
for (const key of Object.keys(env))
  if (/^(GOOGLE_|TELEGRAM_BOT_|SMTP_|RESEND_|STRIPE_|ADMIN_)/.test(key)) delete env[key];
for (const passenger of ["false", "true"]) {
  const result = spawnSync(process.execPath, ["--test", "tests/hosted-runtime.test.cjs"], { env: { ...env, TEST_PASSENGER: passenger }, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

