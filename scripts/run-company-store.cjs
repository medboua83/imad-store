#!/usr/bin/env node
// Load a private installation profile as data, never as shell code.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { parse } = require('dotenv');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function loadProfile(file, root = path.resolve(__dirname, '..')) {
    const profile = path.resolve(file), stat = fs.lstatSync(profile);
    if (profile.startsWith(root + path.sep)) throw new Error('Profil privé hors du code requis.');
    if (!stat.isFile() || stat.size > 65536 || (process.platform !== 'win32' && (stat.mode & 0o077)))
        throw new Error('Profil privé requis : fichier ordinaire, maximum 64 Ko, permissions 600.');
    for (const dir of ['', 'backend', 'apps/web']) {
        if (fs.readdirSync(path.join(root, dir)).some(n => /^\.env(?:\.|$)/.test(n) && n !== '.env.example'))
            throw new Error('Utilisez une copie du code sans fichier .env hérité.');
    }
    const source = fs.readFileSync(profile, 'utf8');
    const vars = parse(source);
    // Generated values are JSON strings; dotenv alone retains escaped quotation marks.
    for (const line of source.split('\n')) {
        const match = /^([A-Z][A-Z0-9_]*)=(".*")$/.exec(line.trim());
        if (match) { try { vars[match[1]] = JSON.parse(match[2]); } catch { /* Edited dotenv value. */ } }
    }
    if (!uuid.test(vars.STORE_INSTANCE_ID || '') || !uuid.test(vars.CRM_COMPANY_ID || '')) throw new Error('Identifiants UUID requis.');
    if (vars.NODE_ENV !== 'production' || vars.IMAD_HOSTING_MODE !== 'combined') throw new Error('Mode combined de production requis.');
    const origin = new URL(vars.CORS_ORIGIN), db = new URL(vars.DATABASE_URL);
    if (origin.protocol !== 'https:' || origin.origin !== vars.CORS_ORIGIN || origin.username || origin.password) throw new Error('Origine HTTPS exacte requise.');
    if (!['mongodb:', 'mongodb+srv:'].includes(db.protocol) || !/^\/[a-zA-Z0-9_-]+$/.test(db.pathname)) throw new Error('Base MongoDB dédiée requise.');
    const keys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DESKCOMM_ENCRYPTION_KEY'].map(k => vars[k]);
    if (keys.some(v => !/^[a-f0-9]{64}$/i.test(v || '')) || new Set(keys).size !== 3) throw new Error('Trois clés privées distinctes requises.');
    if (!/^\d+$/.test(vars.PORT || '') || +vars.PORT < 1 || +vars.PORT > 65535) throw new Error('Port invalide.');
    for (const key of ['DESKCOMM_OUTBOX_WORKER_ENABLED', 'DESKCOMM_HOSTED_DELIVERY_ENABLED'])
        if (!['true', 'false'].includes(vars[key])) throw new Error('Activation CRM explicite requise.');
    if (!vars.DESKCOMM_OUTBOX_MIN_CREATED_AT || !Number.isFinite(Date.parse(vars.DESKCOMM_OUTBOX_MIN_CREATED_AT))) throw new Error('Date limite CRM requise.');
    if (!vars.UPLOAD_DIR || !path.isAbsolute(vars.UPLOAD_DIR)) throw new Error('Stockage absolu requis.');
    const uploads = path.resolve(vars.UPLOAD_DIR), secrets = path.dirname(profile);
    if (uploads === path.parse(uploads).root || uploads === root || uploads.startsWith(root + path.sep) || secrets === uploads || secrets.startsWith(uploads + path.sep)) throw new Error('Séparer images, secrets et code.');
    const env = {};
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG']) if (process.env[key]) env[key] = process.env[key];
    return { vars, env: { ...env, ...vars, DOTENV_CONFIG_PATH: profile }, root };
}
function run(file, action) {
    if (!['check', 'build', 'admin', 'start'].includes(action)) throw new Error('Action : check, build, admin ou start.');
    const { env, vars, root } = loadProfile(file);
    if (action === 'check') return console.log(`Configuration locale valide. Boutique : ${vars.STORE_INSTANCE_ID}. Réseau non vérifié.`);
    if (action === 'admin') {
        if (!process.env.BOOTSTRAP_ADMIN_EMAIL || (process.env.BOOTSTRAP_ADMIN_PASSWORD || '').length < 16) throw new Error('Deux variables BOOTSTRAP_ADMIN requises (mot de passe : 16 caractères minimum).');
        env.BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
        env.BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    }
    const command = action === 'build' ? (process.platform === 'win32' ? 'npm.cmd' : 'npm') : process.execPath;
    const args = action === 'build' ? ['run', 'build'] : action === 'start' ? ['server.js'] : ['--import', 'tsx', 'backend/scripts/provision-company-admin.ts'];
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
    child.once('error', () => { console.error('Impossible de démarrer cette étape.'); process.exitCode = 1; });
    child.once('exit', (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
}
module.exports = { loadProfile, run };
if (require.main === module) {
    try {
        if (process.argv.length !== 4) throw new Error('Usage : store:run <store.env> <check|build|admin|start>');
        run(process.argv[2], process.argv[3]);
    } catch { console.error('Installation refusée : vérifiez le profil privé, ses identifiants, ses clés, le stockage et l’absence de .env hérité.'); process.exitCode = 1; }
}
