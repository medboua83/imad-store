#!/usr/bin/env node
// Generates only a fresh deployment profile; never reads a live environment or database.
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function createProfile({companyId, name, origin, output}) {
    const standalone = companyId === undefined || companyId === null;
    if (!standalone && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(companyId)) throw new Error('Identifiant entreprise CRM UUID invalide');
    if (!name?.trim() || name.length > 100 || /[\r\n\x00-\x1f]/.test(name)) throw new Error('Nom de boutique requis (100 caractères maximum)');
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== origin) throw new Error('Origine HTTPS exacte requise, sans chemin ni barre finale');
    if (!output) throw new Error('Dossier de destination requis');
    const storeId = randomUUID();
    const database = `store_${storeId.replaceAll('-','')}`;
    const secret = () => randomBytes(32).toString('hex');
    const vars = {
        NODE_ENV:'production', IMAD_HOSTING_MODE:'combined', HOSTNAME:'127.0.0.1', IMAD_TRUST_LOOPBACK_PROXY:'true', PORT:'3000', STORE_INSTANCE_ID:storeId,
        STORE_SETUP_MODE:standalone ? 'standalone' : 'crm', ...(standalone ? {} : {CRM_COMPANY_ID:companyId}),
        STORE_DISPLAY_NAME:name, SITE_URL:origin, CORS_ORIGIN:origin, API_UPSTREAM_URL:'http://127.0.0.1:3000',
        DATABASE_URL:`postgresql://store_${storeId.replaceAll('-','').slice(0,12)}_app:CHANGE_ME@127.0.0.1:5432/${database}`,
        JWT_SECRET:secret(), JWT_REFRESH_SECRET:secret(), DESKCOMM_ENCRYPTION_KEY:secret(),
        DESKCOMM_OUTBOX_WORKER_ENABLED:'false', DESKCOMM_HOSTED_DELIVERY_ENABLED:'false',
        DESKCOMM_OUTBOX_MIN_CREATED_AT:new Date().toISOString(),
        UPLOAD_DIR:path.resolve(output,'uploads'),
    };
    // Exclusive directory creation prevents overwriting an existing installation.
    fs.mkdirSync(output,{mode:0o700});
    fs.writeFileSync(path.join(output,'store.env'),Object.entries(vars).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
    if (!standalone) fs.writeFileSync(path.join(output,'crm-registration.json'),JSON.stringify({version:1,company_id:companyId,store_id:storeId,name,origin,secret:secret()},null,2)+'\n',{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(output,'INSTALLATION.txt'),`BOUTIQUE INDÉPENDANTE — ${name}
Mode : ${standalone ? 'Autonome, sans CRM' : 'CRM — entreprise ' + companyId}
Boutique : ${storeId}
Base vide dédiée : ${database}

Ce dossier est privé. Ne jamais le publier dans Git, public/ ou uploads/. ${standalone ? 'Aucun compte CRM, identifiant tiers ou clé CRM n’est requis.' : 'crm-registration.json contient la clé de signature à copier dans les deux administrations.'} Aucun compte, produit, client ou secret existant n'est repris.

1. Cloner le dépôt imad-store dans un dossier neuf, utiliser Node 22 et npm ci --include=dev. Ne pas importer de .env existant.
2. Adapter DATABASE_URL dans store.env à une base PostgreSQL VIDE avec un compte limité à cette base. Définir UPLOAD_DIR sur un stockage persistant dédié hors du code et hors des secrets. Configurer le domaine et HTTPS chez l'hébergeur.
3. Appliquer les migrations PostgreSQL avec le profil privé : npm run store:run -- /chemin/prive/store.env migrate. Depuis le code : npm run store:run -- /chemin/prive/store.env check
4. Compiler : npm run store:run -- /chemin/prive/store.env build
5. Définir temporairement BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD (16 caractères minimum), lancer npm run store:run -- /chemin/prive/store.env admin puis retirer ces variables. Aucun compte prédéfini n'est créé.
6. Démarrer : npm run store:run -- /chemin/prive/store.env start. Configurer un superviseur pour cette commande. Un seul port public (3000 par défaut), pas de deuxième backend sur 4000 en mode combiné.
7. Personnaliser le catalogue, les pages, les informations commerciales, le logo et les couleurs depuis Paramètres > Identité de la boutique. Le premier administrateur initialise le nom choisi, des contacts vides et ${standalone ? 'la confirmation sur le site, sans CRM.' : 'les envois CRM en pause.'} Aucun produit n'est publié automatiquement.
${standalone ? '8. Compléter la livraison, les retours, la confidentialité, les coordonnées, le SMTP et les sauvegardes. Le profil autonome ne peut pas activer un CRM par simple bouton : une liaison ultérieure exige un rattachement contrôlé et ne doit jamais réattribuer une base copiée.' : `
8. Dans l'entreprise CRM ${companyId}, ouvrir Webhooks > Boutiques connectées. Remplir nom, store_id et origin de crm-registration.json. Choisir un pipeline de commandes, une étape de réception et une autre étape de confirmation. Copier secret dans le champ clé. Préparer la source et la règle une seule fois ; la règle reste en pause. Pour Quickydev historique, réutiliser sa connexion déjà rattachée.
9. Copier l'adresse source vers Administration > Intégration CRM de la boutique. Configurer le retour avec la même clé privée, le même pipeline et l'étape confirmée, champ pedido_id. Vérifier les identifiants avant activation.
10. Activer l'envoi et le retour dans la boutique et la règle dans le CRM. Passer DESKCOMM_OUTBOX_WORKER_ENABLED et DESKCOMM_HOSTED_DELIVERY_ENABLED à true dans store.env puis redémarrer. Ne pas reculer la date limite CRM. Tester une commande fictive autorisée : un prospect puis une confirmation, sans doublon et sans changer le paiement. Vérifier l'activité CRM et la file de la boutique.`}

check valide le fichier local, pas les accès PostgreSQL, DNS ou HTTPS. start refuse une base liée à une autre entreprise. Aucun envoi externe, source ou entreprise CRM n'est créé par le générateur.
`,{mode:0o600,flag:'wx'});
    return {storeId,companyId:standalone ? null : companyId,database,mode:standalone ? 'standalone' : 'crm'};
}
module.exports={createProfile};
if(require.main===module){try{
    const args=process.argv.slice(2);
    if(![3,4].includes(args.length)) throw new Error('Usage: npm run store:create -- [UUID entreprise CRM facultatif] <nom boutique> <https://domaine> <nouveau dossier>');
    const [companyId,name,origin,output] = args.length===3 ? [undefined,...args] : args;
    const result=createProfile({companyId,name,origin,output});
    console.log(`Profil indépendant créé : ${result.storeId}. Secrets enregistrés dans le dossier privé, non affichés.`);
}catch(error){console.error(error.message);process.exitCode=1;}}
