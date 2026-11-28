#!/usr/bin/env node
// Reproducible acceptance against a disposable local database, never a store profile.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
try {
    if (process.argv.length !== 2) throw new Error('No store or profile arguments accepted');
    // Validate before spawning anything, and never echo a malformed connection string.
    require('./test-postgres.cjs').databaseUrl('imad_ci_0000000000000000');
    const env = { NODE_ENV: 'test', INTEGRATION_TEST_MODE: 'true', IMAD_AUTH_MAIL_WORKER_DISABLED: 'true',
        DESKCOMM_OUTBOX_WORKER_ENABLED: 'false', DESKCOMM_HOSTED_DELIVERY_ENABLED: 'false' };
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'IMAD_TEST_POSTGRES_URL'])
        if (process.env[key]) env[key] = process.env[key];
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/fresh-runtime-installation.test.ts'], {
        cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
} catch {
    console.error('Recette refusée : PostgreSQL de test local requis, base /postgres, aucun profil de boutique accepté.');
    process.exitCode = 1;
}
