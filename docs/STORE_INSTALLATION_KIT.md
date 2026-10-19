# Installer une boutique modèle pour une entreprise CRM

Ce kit utilise le code commun et une installation indépendante par boutique. Il ne copie ni la base de Quickydev, ni ses comptes, ni ses secrets. Il prépare l'installation et la connexion commandes/confirmations ; le nom visuel, le logo, les couleurs, le catalogue et les conditions commerciales restent à personnaliser avant publication.

## Livrer le code

Prérequis : Node.js 22, npm, MongoDB en replica set, un domaine HTTPS, un compte MongoDB restreint à une seule base et un stockage d’images persistant distinct. L’ancien `docker-compose.yml` à Postgres n’est pas le moyen d’installer cette boutique MongoDB.

À partir du dépôt à jour et propre :

```sh
npm run store:bundle -- /chemin/prive/boutique.tar.gz
```

L’archive contient le code suivi par Git du commit affiché, sans historique Git, dépendances installées, fichiers privés ignorés, base ou images téléversées locales. Elle ne crée aucun accès. Ne pas inclure un profil d’entreprise dans l’archive commune. La commande refuse un arbre sale et l’écrasement d’une archive existante.

Décompresser dans un dossier neuf, puis entrer dans `boutique/` et installer les dépendances avec `npm ci --include=dev`. On peut également utiliser un clone propre du même commit.

## Préparer l’entreprise

Créer l’entreprise dans le CRM et relever son UUID réel. Le nom d’entreprise, l’UUID de source ou une référence de commande ne remplacent pas cet UUID. L’opérateur CRM peut relever l’identifiant de son organisation dans son contexte administrateur ; ne jamais réutiliser celui d’une autre entreprise.

```sh
npm run store:create -- UUID_ENTREPRISE_CRM "Nouvelle boutique" https://boutique.example /chemin/prive/nouveau-profil
```

Le dossier neuf est privé (700) et les trois fichiers sont privés (600) :

- `store.env` : identité immuable, base dédiée, clés JWT/chiffrement et réglages serveur ;
- `crm-registration.json` : nom, entreprise, boutique, domaine et clé de signature dédiée ; c’est une fiche privée à lire, pas un fichier à téléverser dans le formulaire actuel ;
- `INSTALLATION.txt` : procédure propre à cette installation.

Ne pas les placer dans le code, `public/`, les images ou Git. Ne pas exécuter `source store.env` : les valeurs sont des données, chargées par l’outil ci-dessous. Ne pas reprendre un profil pour créer une autre boutique.

Adapter `DATABASE_URL` à une base **vide**, avec son utilisateur dédié. Adapter `UPLOAD_DIR` au stockage persistant de cette seule boutique, hors du code et hors des secrets. Le domaine, les droits MongoDB, les sauvegardes et HTTPS sont à provisionner chez l’hébergeur ; le générateur ne les crée pas.

## Vérifier, compiler et démarrer

```sh
npm run store:run -- /chemin/prive/nouveau-profil/store.env check
npm run store:run -- /chemin/prive/nouveau-profil/store.env build
```

`check` ne se connecte à aucun service : il vérifie identités, mode combiné, HTTPS déclaré, format des clés, port, date limite et séparation des chemins. Il refuse aussi les fichiers `.env` hérités dans le code. Il ne prouve pas DNS, certificat, autorisations MongoDB ou disponibilité du stockage.

Définir temporairement `BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` (minimum 16 caractères), sans les enregistrer dans Git, puis :

```sh
npm run store:run -- /chemin/prive/nouveau-profil/store.env admin
```

Retirer ces deux variables après création. Ce programme refuse de réinitialiser une installation contenant déjà un utilisateur. Les variables d’une autre application ne sont pas héritées par le lanceur. Le profil est chargé explicitement ; les valeurs ne sont jamais exécutées par un interpréteur de commandes.

```sh
npm run store:run -- /chemin/prive/nouveau-profil/store.env start
```

Configurer le superviseur de l’hébergeur pour relancer cette commande. Un seul port public, 3000 par défaut ; pas de deuxième processus sur 4000 en mode combiné. Le premier accès réserve l’identité de la base et crée les index uniques ; une base non vide sans identité ou liée à une autre boutique est refusée. Ne pas utiliser `prisma db push` sur une base active.

## Remplir le module CRM

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
