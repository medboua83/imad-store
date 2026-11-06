// PostgreSQL connection URLs are passed unchanged; credentials are never logged.
async function resolveHostedDatabase(uri) {
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("Invalid PostgreSQL connection"); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !/^\/[a-zA-Z0-9_-]+$/.test(parsed.pathname))
    throw new Error("A dedicated PostgreSQL database is required");
  return uri;
}
module.exports = { resolveHostedDatabase };
