const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveHostedDatabase } = require("../scripts/resolve-hosted-database.cjs");
test("PostgreSQL credentials and options are preserved without DNS rewriting", async () => {
  const url = "postgresql://test:p%40ss@127.0.0.1:5432/store?connection_limit=5";
  assert.equal(await resolveHostedDatabase(url), url);
});
test("MongoDB and incomplete URLs fail closed without exposing credentials", async () => {
  for (const url of ["mongodb://user:secret@localhost/store", "postgresql://localhost/", "sensitive-invalid"])
    await assert.rejects(() => resolveHostedDatabase(url), error => !error.message.includes("secret") && !error.message.includes("sensitive-invalid"));
});
