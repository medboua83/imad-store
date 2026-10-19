#!/usr/bin/env node
// Generates only a fresh deployment profile; never reads a live environment or database.
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function createProfile({companyId, name, origin, output}) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(companyId || '')) throw new Error('Identifiant entreprise CRM UUID requis');
    if (!name || name.length > 100 || /[\r\n\x00-\x1f]/.test(name)) throw new Error('Nom de boutique requis (100 caractères maximum)');
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== origin) throw new Error('Origine HTTPS exacte requise, sans chemin ni barre finale');
    if (!output) throw new Error('Dossier de destination requis');
    const storeId = randomUUID();
    const database = `store_${storeId.replaceAll('-','')}`;
    const secret = () => randomBytes(32).toString('hex');
    const vars = {
        NODE_ENV:'production', IMAD_HOSTING_MODE:'combined', PORT:'3000', STORE_INSTANCE_ID:storeId, CRM_COMPANY_ID:companyId,
        STORE_DISPLAY_NAME:name, CORS_ORIGIN:origin, API_UPSTREAM_URL:'http://127.0.0.1:4000',
        DATABASE_URL:`mongodb://127.0.0.1:27017/${database}?replicaSet=rs0`,
        JWT_SECRET:secret(), JWT_REFRESH_SECRET:secret(), DESKCOMM_ENCRYPTION_KEY:secret(),
        DESKCOMM_OUTBOX_WORKER_ENABLED:'true', DESKCOMM_HOSTED_DELIVERY_ENABLED:'true',
        DESKCOMM_OUTBOX_MIN_CREATED_AT:new Date().toISOString(),
        UPLOAD_DIR:path.resolve(output,'uploads'),
    };
    // Exclusive directory creation prevents overwriting an existing installation.
    fs.mkdirSync(output,{mode:0o700});
    fs.writeFileSync(path.join(output,'store.env'),Object.entries(vars).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(output,'INSTALLATION.txt'),`Profil neuf pour ${name}\nEntreprise CRM : ${companyId}\nBoutique : ${storeId}\nBase dédiée : ${database}\n\nConserver store.env hors Git. Adapter DATABASE_URL à une base Mongo vide avec un compte limité à cette base. Ne jamais copier les données, sessions, images ou secrets d’une autre boutique. Chaque boutique a son domaine, son déploiement, sa base et son dossier images. Le dossier images généré est local : définir un chemin persistant propre à ce déploiement sur l’hébergement.\n\n1. Installer les variables sur le nouveau déploiement avant le premier démarrage. Les clés de la boutique existante ne sont pas réutilisées.\n2. Créer son premier administrateur avec backend/scripts/provision-company-admin.ts (variables BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD, minimum 16 caractères ; ne pas les enregistrer dans Git), sans importer de compte existant.\n3. Personnaliser catalogue, pages et informations commerciales depuis l’administration ; adapter aussi le nom, le logo et les couleurs du modèle avant publication. STORE_DISPLAY_NAME nomme l’origine des commandes CRM, pas tous les éléments visuels du site. Aucun contenu commercial réel n’est copié par cet outil.\n4. Dans la bonne entreprise du CRM, créer sa source webhook ; l’enregistrer dans Administration > Intégration CRM de cette boutique.\n5. Créer une clé de signature dédiée (64 caractères hexadécimaux). Configurer pipeline, étape de confirmation et champ pedido_id dans la boutique. Enregistrer d’abord en pause.\n6. Dans le CRM, créer une règle lead.stage_changed filtrée sur ce pipeline et son étape confirmée. Destination : ${origin}/api/integrations/deskcomm/status-callback. Même clé de signature. Activer les deux côtés après vérification.\n7. Tester une commande fictive autorisée : une commande, un prospect, une confirmation. Ne pas rejouer l’historique.\n\nLe CRM conserve sa propre gestion des entreprises ; ce profil ne crée pas automatiquement une entreprise CRM ni sa règle.\n`,{mode:0o600,flag:'wx'});
    return {storeId,companyId,database};
}
module.exports={createProfile};
if(require.main===module){try{
    const args=process.argv.slice(2);
    if(args.length!==4) throw new Error('Usage: npm run store:create -- <UUID entreprise CRM> <nom boutique> <https://domaine> <nouveau dossier>');
    const result=createProfile({companyId:args[0],name:args[1],origin:args[2],output:args[3]});
    console.log(`Profil indépendant créé : ${result.storeId}. Secrets enregistrés dans le dossier privé, non affichés.`);
}catch(error){console.error(error.message);process.exitCode=1;}}
