const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveHostedDatabase } = require("../scripts/resolve-hosted-database.cjs");
const dns = {
  resolveSrv: async () => [{ name: "node0.example.test", port: 27017 }, { name: "node1.example.test.", port: 27018 }],
  resolveTxt: async () => [["authSource=admin&replica", "Set=replica-test"]],
};
test("SRV expansion preserves encoded credentials, database, explicit options and implicit TLS", async () => {
  const value = await resolveHostedDatabase("mongodb+srv://test:p%40ss@cluster.example.test/store?retryWrites=true&authSource=owner", dns);
  assert.match(value, /^mongodb:\/\/test:p%40ss@node0.example.test:27017,node1.example.test:27018\/store\?/);
  const query = new URLSearchParams(value.split("?")[1]);
  assert.equal(query.get("authsource"), "owner"); assert.equal(query.get("replicaset"), "replica-test");
  assert.equal(query.get("tls"), "true"); assert.equal(query.get("retrywrites"), "true");
  assert.equal(await resolveHostedDatabase("mongodb://127.0.0.1:27017/test", {}), "mongodb://127.0.0.1:27017/test");
});
test("SRV expansion rejects cross-domain targets and unsafe/ambiguous TXT records", async () => {
  const uri = "mongodb+srv://cluster.example.test/store";
  await assert.rejects(resolveHostedDatabase(uri, { ...dns, resolveSrv: async () => [{ name: "attacker.invalid", port: 27017 }] }), /Invalid SRV target/);
  await assert.rejects(resolveHostedDatabase(uri, { ...dns, resolveTxt: async () => [["tls=false"]] }), /Invalid MongoDB TXT option/);
  await assert.rejects(resolveHostedDatabase(uri, { ...dns, resolveTxt: async () => [["authSource=a"], ["authSource=b"]] }), /Multiple/);
  const absent = { ...dns, resolveTxt: async () => { throw Object.assign(new Error(), { code: "ENODATA" }); } };
  assert.match(await resolveHostedDatabase(uri, absent), /tls=true/);
  await assert.rejects(resolveHostedDatabase(uri, { ...dns, resolveTxt: async () => { throw Object.assign(new Error(), { code: "ETIMEOUT" }); } }), { code: "ETIMEOUT" });
});
