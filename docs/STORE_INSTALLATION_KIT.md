# Installer une boutique indépendante — CRM facultatif

Ce kit utilise le code commun et une installation indépendante par boutique, avec ou sans CRM. Il ne copie ni la base de Quickydev, ni ses comptes, ni ses secrets. Le nom, les logos, les couleurs, les coordonnées, le catalogue et les conditions commerciales se règlent pour chaque marchand.

## Livrer le code

Prérequis : Node.js 22, npm, PostgreSQL 16, un domaine HTTPS, un compte PostgreSQL restreint à une seule base et un stockage d’images persistant distinct. Le fichier `docker-compose.yml` sert au développement local : mot de passe explicite, ports limités à la boucle locale. Pour Namecheap sans SSE4.2, suivre aussi [le guide PostgreSQL/images](POSTGRESQL_NAMECHEAP_2026-11-06.md).

À partir du dépôt à jour et propre :

```sh
npm run store:bundle -- /chemin/prive/boutique.tar.gz
```

L’archive contient le code suivi par Git du commit affiché, sans historique Git, dépendances installées, fichiers privés ignorés, base ou images téléversées locales. Elle ne crée aucun accès. Ne pas inclure un profil d’entreprise dans l’archive commune. La commande refuse un arbre sale et l’écrasement d’une archive existante.

Décompresser dans un dossier neuf, puis entrer dans `boutique/` et installer les dépendances avec `npm ci --include=dev`. On peut également utiliser un clone propre du même commit.

## Préparer une boutique autonome

Aucun compte CRM ni UUID tiers n'est nécessaire :

```sh
npm run store:create -- "Nouvelle boutique" https://boutique.example /chemin/prive/nouveau-profil
```

Le mode autonome possède une identité, une base et un nom de rôle applicatif distincts. Les services CRM restent désactivés, y compris si une requête tente de les activer. Le premier administrateur initialise le nom choisi, des contacts sociaux vides, aucun Pixel et la confirmation des commandes sur le site. Aucun produit, client, compte prédéfini ou photo téléversée d'IMAD n'est copié.

Ne pas convertir ce profil en changeant simplement ses variables : l'identité est liée à sa base. Une liaison CRM ultérieure exige une opération contrôlée avec sauvegarde et rapprochement explicite ; ne jamais adopter la base d'un autre marchand.

## Variante : préparer une entreprise CRM

Créer l’entreprise dans le CRM et relever son UUID réel. Le nom d’entreprise, l’UUID de source ou une référence de commande ne remplacent pas cet UUID. L’opérateur CRM peut relever l’identifiant de son organisation dans son contexte administrateur ; ne jamais réutiliser celui d’une autre entreprise.

```sh
npm run store:create -- UUID_ENTREPRISE_CRM "Nouvelle boutique" https://boutique.example /chemin/prive/nouveau-profil
```

Le dossier neuf est privé (700) et ses fichiers sont privés (600) :

- `store.env` : identité immuable, base dédiée, clés JWT/chiffrement et réglages serveur ;
- `crm-registration.json` (variante CRM uniquement) : nom, entreprise, boutique, domaine et clé de signature dédiée ; c’est une fiche privée à lire, pas un fichier à téléverser dans le formulaire actuel ;
- `INSTALLATION.txt` : procédure propre à cette installation.

Ne pas les placer dans le code, `public/`, les images ou Git. Ne pas exécuter `source store.env` : les valeurs sont des données, chargées par l’outil ci-dessous. Ne pas reprendre un profil pour créer une autre boutique.

Adapter `DATABASE_URL` à une base PostgreSQL **vide**, avec son utilisateur dédié. Appliquer les migrations avec un propriétaire de schéma réservé à cette opération, puis configurer un rôle applicatif limité pour le démarrage ; les deux connexions doivent viser la même base. Ne pas utiliser le rôle de test avec CREATEDB pour le service. Adapter `UPLOAD_DIR` au stockage persistant de cette seule boutique, hors du code et hors des secrets. Le domaine, les droits PostgreSQL, les sauvegardes et HTTPS sont à provisionner chez l’hébergeur ; le générateur ne les crée pas.

Le mot de passe PostgreSQL `CHANGE_ME` doit être remplacé dans le fichier privé. Préparer aussi une copie privée `migrate.env` avec les mêmes identifiants de boutique et clés, mais une connexion de propriétaire de schéma. Utiliser `store.env` avec le rôle applicatif limité pour le service. Le contrôle statique ne prouve pas que la base est joignable ; ne jamais diffuser le profil de migration.

## Vérifier, compiler et démarrer

```sh
npm run store:run -- /chemin/prive/nouveau-profil/store.env check
npm run store:run -- /chemin/prive/nouveau-profil/migrate.env migrate
npm run store:run -- /chemin/prive/nouveau-profil/store.env build
```

`check` ne se connecte à aucun service : il vérifie identités, mode combiné, HTTPS déclaré, format des clés, port, date limite et séparation des chemins. Il refuse aussi les fichiers `.env` hérités dans le code. Il ne prouve pas DNS, certificat, autorisations PostgreSQL ou disponibilité du stockage.

Créer le rôle applicatif distinct avec LOGIN, sans SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS ni appartenance à un autre rôle. Le propriétaire de migration possède la base et le schéma, pas le rôle applicatif. Après les migrations et avant les données, appliquer `scripts/runtime-permissions.sql` avec la connexion du propriétaire et `-v app_role=nom_du_role_applicatif`. Le script refuse un rôle privilégié ou une base déjà remplie. Il autorise les opérations applicatives et laisse les registres POS en lecture/insertion, avec la seule mise à jour de session active prévue. Ne pas exécuter ce script d'initialisation sur une boutique existante pour « réparer » ses droits.

Définir temporairement `BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` (minimum 16 caractères), sans les enregistrer dans Git, puis :

```sh
npm run store:run -- /chemin/prive/nouveau-profil/store.env admin
```

Retirer ces deux variables après création. Ce programme refuse de réinitialiser une installation contenant déjà un utilisateur. Les variables d’une autre application ne sont pas héritées par le lanceur. Le profil est chargé explicitement ; les valeurs ne sont jamais exécutées par un interpréteur de commandes.

```sh
npm run store:run -- /chemin/prive/nouveau-profil/store.env start
```

Configurer le superviseur de l’hébergeur pour relancer cette commande. Un seul port public, 3000 par défaut ; pas de deuxième processus sur 4000 en mode combiné. Les migrations appliquent les contraintes uniques et les relations avant le démarrage ; le premier accès réserve l’identité de la base ; une base non vide sans identité ou liée à une autre boutique est refusée. Ne pas utiliser `prisma db push` sur une base active.

Le profil neuf écoute sur `127.0.0.1` derrière le reverse proxy HTTPS de l'hébergeur, avec `IMAD_TRUST_LOOPBACK_PROXY=true` pour reconnaître ce seul proxy local. Si le port change, adapter aussi `API_UPSTREAM_URL`. Le proxy doit remplacer les en-têtes de transfert par ceux de la connexion vérifiée. Pour une architecture différente, réviser explicitement cette option ; ne pas faire confiance à un `X-Forwarded-For` fourni directement par Internet.

## Personnaliser et réceptionner

Dans Paramètres → Identité de la boutique, compléter les logos, couleurs et coordonnées. Le nom du profil est utilisé avant la première personnalisation. Compléter les règles de livraison et retour, les textes commerciaux et la confidentialité. Le bilan « Préparation de la boutique » ne valide pas ces textes à la place du marchand et ne prouve pas la réception SMTP.

Consulter le [guide marchand](MERCHANT_GUIDE.md), le [modèle de remise](CLIENT_HANDOVER.md), la [recette de livraison](RESALE_DELIVERY.md), `LICENSE`, `DISTRIBUTION_RIGHTS.md` et les notices tierces avant toute remise externe.

Le kit inclut les paquets locaux nécessaires, notamment `packages/glob-compat`, et des guides portables, sans journal privé d'exploitation IMAD. Réinstaller les dépendances pour la plateforme cible ; ne pas copier `node_modules` ou une compilation d'un autre système.

## Remplir le module CRM — variante CRM seulement

Ouvrir **Webhooks → Boutiques connectées** dans la bonne entreprise. Comparer son UUID avec `company_id` de la fiche privée avant de préparer la connexion.

| Champ CRM | Valeur |
| --- | --- |
| Nom de la boutique | `name` de `crm-registration.json` |
| Identifiant de la boutique | `store_id` ; également visible dans l’administration boutique |
| Adresse HTTPS | `origin`, sans chemin ni barre finale |
| Pipeline | Pipeline de commandes de cette entreprise |
| Étape de réception | Par exemple « À confirmer » |
| Étape confirmée | Une autre étape, par exemple « Commande confirmée » |
| Clé de signature | `secret` de la fiche privée, identique dans la boutique |

**Préparer la source et la règle** les crée atomiquement, avec la règle en pause. Refaire exactement la même demande retrouve la connexion ; ne pas créer manuellement une seconde source. Le CRM résout toujours l’entreprise depuis la session ; la fiche n’est pas une autorisation.

Dans Administration boutique → Intégration CRM : enregistrer l’adresse source du CRM, puis le retour avec la même clé, le pipeline et l’étape confirmée, champ `pedido_id`. Comparer l’entreprise et la boutique affichées. La source et la règle historiques de Quickydev restent rattachées : ne pas remplir le formulaire de nouvelle boutique pour elles.

## Activer et tester

Les nouveaux profils mettent les deux travailleurs d’envoi **à false**. Après vérification, activer l’envoi et le retour dans l’administration, activer la règle CRM, passer `DESKCOMM_OUTBOX_WORKER_ENABLED` et `DESKCOMM_HOSTED_DELIVERY_ENABLED` à `true`, puis redémarrer. Ne pas reculer `DESKCOMM_OUTBOX_MIN_CREATED_AT`. Les commandes éligibles en attente peuvent alors partir : effectuer les essais après configuration complète, avec données fictives autorisées.

Contrôler : une commande → un événement d’envoi → un prospect ; confirmation dans le CRM → une transition Confirmée dans la boutique, paiement inchangé. Les répétitions signées ont un reçu unique. Une signature d’une autre entreprise est refusée. Sur erreur, désactiver l’envoi et la règle, consulter Suivi CRM de la commande et Activité ; ne pas dupliquer une source ou rejouer l’historique.

Cette connexion **n’active pas les messages IA/WhatsApp**. Le premier contact exige son propre agent, canal, signature entrante, autorisation de source et les informations d’accord requises par le CRM. Une commande transmise n’est pas une preuve de consentement à un service automatisé.

Le kit contient aussi les configurations Playwright utilisées par les tests d’interface et le fichier Docker Compose de développement référencé dans les prérequis. La découverte `npx playwright test --list` doit rester limitée aux scénarios `tests/ui` ; ne pas lancer la recette contre le domaine de production. Le fichier Compose n’est pas une configuration de production et exige son propre mot de passe local.
