#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function bundle(output, root = path.resolve(__dirname, '..')) {
    const destination = path.resolve(output);
    if (!destination.endsWith('.tar.gz') || destination === root || destination.startsWith(root + path.sep)) throw new Error('Archive .tar.gz hors du code requise.');
    const git = args => execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    if (git(['status','--porcelain','--untracked-files=normal']).trim()) throw new Error('Commitez et vérifiez le code avant de créer le kit.');
    const files = git(['ls-files','-z']).split('\0').filter(Boolean);
    if (files.some(f => /(?:^|\/)(?:\.env(?:\..+)?|store\.env|crm-registration\.json)$/.test(f) && f !== '.env.example' && !f.endsWith('/.env.example'))) throw new Error('Un fichier privé est suivi par Git.');
    const revision = git(['rev-parse','HEAD']).trim();
    // Archive only distributable source. No Git history, private environment, DB or local uploads.
    const paths = ['package.json','package-lock.json','.npmrc','.gitignore','server.js','turbo.json','tsconfig.json','scripts','apps/web','backend','packages/shared','tests','docs/STORE_INSTALLATION_KIT.md'].filter(p => files.some(f => f === p || f.startsWith(p + '/')));
    const fd = fs.openSync(destination,'wx',0o600);
    try { execFileSync('git',['archive','--format=tar.gz','--prefix=boutique/','HEAD','--',...paths],{cwd:root,stdio:['ignore',fd,'pipe']}); }
    catch(error) { fs.closeSync(fd); fs.unlinkSync(destination); throw error; }
    fs.closeSync(fd);
    return {revision,destination};
}
module.exports={bundle};
if(require.main===module){try{
    if(process.argv.length!==3) throw new Error('Usage : npm run store:bundle -- /destination/boutique.tar.gz');
    const result=bundle(process.argv[2]); console.log(`Kit créé depuis le commit ${result.revision}. Aucun profil privé inclus.`);
}catch{console.error('Création refusée : destination neuve hors du code et arbre Git propre sans profil privé requis.');process.exitCode=1;}}
