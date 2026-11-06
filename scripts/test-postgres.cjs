// Disposable databases only. Never infer an administrative connection from DATABASE_URL.
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const base = () => {
  const url = new URL(process.env.IMAD_TEST_POSTGRES_URL || 'postgresql://imad_test:imad_test_local@127.0.0.1:5432/postgres');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/postgres' || url.search)
    throw new Error('Isolated local PostgreSQL test role required');
  return url;
};
function databaseUrl(name) {
  if (!/^imad_ci_[a-f0-9]{16}$/.test(name)) throw new Error('Disposable database name required');
  const url = base(); url.pathname = '/' + name; return url.toString();
}
async function admin(fn) {
  const client = new PrismaClient({ datasources: { db: { url: base().toString() } } });
  try { return await fn(client); } finally { await client.$disconnect(); }
}
async function createDatabase(name) {
  databaseUrl(name);
  await admin(client => client.$executeRawUnsafe(`CREATE DATABASE "${name}"`));
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.resolve(__dirname, '../backend/prisma/schema.prisma')], {
    env: { ...process.env, DATABASE_URL: databaseUrl(name) }, encoding: 'utf8',
  });
  if (result.status !== 0) { await dropDatabase(name); throw new Error('Isolated schema migration failed: ' + result.stderr); }
}
async function dropDatabase(name) {
  databaseUrl(name);
  await admin(client => client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}
module.exports = { databaseUrl, createDatabase, dropDatabase };
