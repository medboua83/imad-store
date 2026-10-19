// Resolve the MongoDB SRV/TXT seed list with Node before Prisma starts. Some
// hosting resolv.conf options cannot be parsed by Prisma 5's Rust DNS resolver.
// Credentials remain in memory; the stored environment value is never edited.
async function resolveHostedDatabase(uri, dns = require("node:dns/promises")) {
  if (!uri?.startsWith("mongodb+srv://")) return uri;
  const parsed = new URL(uri);
  if (parsed.port || parsed.hostname.split(".").length < 3) throw new Error("Invalid SRV hostname");
  const options = new Map();
  for (const [key, value] of parsed.searchParams) {
    const name = key.toLowerCase();
    if (options.has(name)) throw new Error("Duplicate database option");
    options.set(name, value);
  }
  if (options.has("srvmaxhosts") || options.has("srvservicename") || options.get("directconnection") === "true")
    throw new Error("Unsupported hosted SRV option");
  const records = await dns.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  const parent = parsed.hostname.toLowerCase().split(".").slice(1).join(".");
  const hosts = records.map(({ name, port }) => {
    const host = name.toLowerCase().replace(/\.$/, "");
    if (!host.endsWith(`.${parent}`) || !/^[a-z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Invalid SRV target");
    return `${host}:${port}`;
  });
  if (!hosts.length) throw new Error("Empty SRV seed list");
  let txt = [];
  try { txt = await dns.resolveTxt(parsed.hostname); }
  catch (error) { if (!["ENODATA", "ENOTFOUND"].includes(error.code)) throw error; }
  if (txt.length > 1) throw new Error("Multiple MongoDB TXT records");
  if (txt.length) {
    const seen = new Set();
    for (const [key, value] of new URLSearchParams(txt[0].join(""))) {
      const name = key.toLowerCase();
      if (!["authsource", "replicaset", "loadbalanced"].includes(name) || !value || seen.has(name)) throw new Error("Invalid MongoDB TXT option");
      seen.add(name);
      if (!options.has(name)) options.set(name, value);
    }
  }
  // SRV implies TLS. Preserve explicit existing TLS/SSL settings and all query
  // options; never disable certificate or hostname verification.
  if (!options.has("tls") && !options.has("ssl")) options.set("tls", "true");
  const auth = parsed.username ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@` : "";
  return `mongodb://${auth}${hosts.join(",")}${parsed.pathname || "/"}?${new URLSearchParams(options)}`;
}
module.exports = { resolveHostedDatabase };
