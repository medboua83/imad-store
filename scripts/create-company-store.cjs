#!/usr/bin/env node
// Generates only a fresh deployment profile; never reads a live environment or database.
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function createProfile({companyId, name, origin, output}) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(companyId || '')) throw new Error('Identifiant entreprise CRM UUID requis');
    if (!name?.trim() || name.length > 100 || /[\r\n\x00-\x1f]/.test(name)) throw new Error('Nom de boutique requis (100 caractères maximum)');
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
        DESKCOMM_OUTBOX_WORKER_ENABLED:'false', DESKCOMM_HOSTED_DELIVERY_ENABLED:'false',
        DESKCOMM_OUTBOX_MIN_CREATED_AT:new Date().toISOString(),
        UPLOAD_DIR:path.resolve(output,'uploads'),
    };
    // Exclusive directory creation prevents overwriting an existing installation.
    fs.mkdirSync(output,{mode:0o700});
    fs.writeFileSync(path.join(output,'store.env'),Object.entries(vars).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(output,'crm-registration.json'),JSON.stringify({version:1,company_id:companyId,store_id:storeId,name,origin,secret:secret()},null,2)+'\n',{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(output,'INSTALLATION.txt'),`BOUTIQUE INDÉPENDANTE — ${name}
Entreprise CRM : ${companyId}
Boutique : ${storeId}
Base vide dédiée : ${database}

Ce dossier est privé. Ne jamais le publier dans Git, public/ ou uploads/. crm-registration.json contient la clé de signature à copier dans les deux administrations. Aucun compte, produit, client ou secret existant n'est repris.

1. Cloner le dépôt imad-store dans un dossier neuf, utiliser Node 22 et npm ci --include=dev. Ne pas importer de .env existant.
2. Adapter DATABASE_URL dans store.env à une base MongoDB VIDE en replica set avec un compte limité à cette base. Définir UPLOAD_DIR sur un stockage persistant dédié hors du code et hors des secrets. Configurer le domaine et HTTPS chez l'hébergeur.
3. Depuis le code : npm run store:run -- /chemin/prive/store.env check
4. Compiler : npm run store:run -- /chemin/prive/store.env build
5. Définir temporairement BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD (16 caractères minimum), lancer npm run store:run -- /chemin/prive/store.env admin puis retirer ces variables. Aucun compte prédéfini n'est créé.
6. Démarrer : npm run store:run -- /chemin/prive/store.env start. Configurer un superviseur pour cette commande. Un seul port public (3000 par défaut), pas de deuxième backend sur 4000 en mode combiné.
7. Personnaliser le catalogue, les pages, les informations commerciales, le logo et les couleurs. STORE_DISPLAY_NAME nomme l'origine des commandes CRM, pas toute la vitrine. Aucun produit n'est publié automatiquement.
8. Dans l'entreprise CRM ${companyId}, ouvrir Webhooks > Boutiques connectées. Remplir nom, store_id et origin de crm-registration.json. Choisir un pipeline de commandes, une étape de réception et une autre étape de confirmation. Copier secret dans le champ clé. Préparer la source et la règle une seule fois ; la règle reste en pause. Pour Quickydev historique, réutiliser sa connexion déjà rattachée.
9. Copier l'adresse source vers Administration > Intégration CRM de la boutique. Configurer le retour avec la même clé privée, le même pipeline et l'étape confirmée, champ pedido_id. Vérifier les identifiants avant activation.
10. Activer l'envoi et le retour dans la boutique et la règle dans le CRM. Passer DESKCOMM_OUTBOX_WORKER_ENABLED et DESKCOMM_HOSTED_DELIVERY_ENABLED à true dans store.env puis redémarrer. Ne pas reculer la date limite CRM. Tester une commande fictive autorisée : un prospect puis une confirmation, sans doublon et sans changer le paiement. Vérifier l'activité CRM et la file de la boutique.

check valide le fichier local, pas les accès MongoDB, DNS ou HTTPS. start refuse une base liée à une autre entreprise. Aucun envoi externe, source ou entreprise CRM n'est créé par le générateur.
`,{mode:0o600,flag:'wx'});
    return {storeId,companyId,database};
}
module.exports={createProfile};
if(require.main===module){try{
    const args=process.argv.slice(2);
    if(args.length!==4) throw new Error('Usage: npm run store:create -- <UUID entreprise CRM> <nom boutique> <https://domaine> <nouveau dossier>');
    const result=createProfile({companyId:args[0],name:args[1],origin:args[2],output:args[3]});
    console.log(`Profil indépendant créé : ${result.storeId}. Secrets enregistrés dans le dossier privé, non affichés.`);
}catch(error){console.error(error.message);process.exitCode=1;}}
