# Boutique e-commerce — IMAD Mode

Application de boutique indépendante : vitrine web, administration et caisse. Ce dépôt maintient la version utilisée sur imadmode.com. Une installation par entreprise possède sa propre base, ses images, ses comptes, ses secrets et ses connexions externes ; ce n'est pas un service multi-boutiques partageant la même base.

## Fonctions actuelles

- Vitrine en arabe : catalogue, catégories, variantes couleur/taille, associations photo-couleur, panier et commande sans compte obligatoire.
- Paiement web à la livraison. Le paiement en ligne par carte est désactivé côté serveur ; ne pas annoncer une intégration Stripe/CMI active.
- Administration français/arabe : catalogue, stock, contenu, commandes, recherche dans l'historique, périodes, export filtré et statistiques de visites.
- Équipe et permissions par module, invitations et récupération d'accès par Gmail SMTP après configuration par le propriétaire.
- Liens sociaux, WhatsApp, vérification de domaine et Pixel Meta configurables par installation. Une configuration technique ne constitue pas une garantie d'attribution publicitaire ou de conformité juridique.
- Olivraison : suivi automatique, garde-fous contre les doublons et validation manuelle pour les numéros associés aux annulations. Une connexion doit être configurée et activée explicitement.
- Caisse : variantes, stock partagé, espèces, enregistrement d'un paiement déjà encaissé par TPE externe, tickets, historique, sessions personnelles, retours et échanges. Le site ne pilote pas un terminal de carte bancaire et ne fournit pas de caisse hors ligne ou de certification fiscale.

Les fonctionnalités réelles et leurs limites priment sur les anciennes notes historiques. Le stock, les paiements et la création de colis sont des opérations distinctes : « livré » ne signifie pas automatiquement « paiement encaissé ».

## Installation et exploitation

Prérequis maintenus : Node.js 22, npm, PostgreSQL 16, domaine HTTPS et stockage d'images persistant. Python 3 sert aux contrôles de sauvegarde et à leurs tests. Les installations sur processeur générique peuvent nécessiter la compilation des images décrite ci-dessous.

- [Kit d'installation indépendante](docs/STORE_INSTALLATION_KIT.md) : profil privé, base vide, premier administrateur, compilation et démarrage. Le kit actuel demande un identifiant d'entreprise CRM ; un parcours d'installation sans CRM et une personnalisation complète de marque restent à préparer pour une offre standardisée.
- [PostgreSQL et hébergement Namecheap](docs/POSTGRESQL_NAMECHEAP_2026-11-06.md).
- [Sauvegarde, vérification et reprise](docs/RECOVERY_OPERATIONS.md).
- [Règles commerciales](docs/COMMERCE_RULES.md).
- [Guide de caisse](docs/CAISSE.md).
- [Permissions et Gmail](docs/CURRENT_STATUS.md) et [historique du projet](docs/PROJECT_MEMORY.md).

La procédure courante utilise `npm ci`, `prisma migrate deploy`, puis le serveur combiné Next/Express avec un seul port public derrière le reverse proxy. Suivre le kit avec le profil de l'installation ; ne pas démarrer plusieurs serveurs concurrents en production. Aucun identifiant administrateur universel ne doit être distribué. Ne jamais réinitialiser ou remplir automatiquement une base active.

Les connexions, le SMTP, les tarifs, les conditions et les médias doivent appartenir au marchand de chaque installation. Ne pas copier les profils ni les données d'une boutique pour en créer une autre. `STORE_DISPLAY_NAME` ne renomme pas encore toutes les pages et tous les messages.

## Développement et vérifications

Après installation des dépendances et configuration d'un environnement isolé :

```sh
npm run check
npm run test:security
npm run test:ui
npm run test:installer
npm test
```

Les tests serveur exigent un rôle PostgreSQL de test distinct, local, autorisé à créer uniquement les bases jetables du lanceur. Voir le guide PostgreSQL pour `IMAD_TEST_POSTGRES_URL`. Les tests d'interface utilisent des données fictives ; ne pas les diriger vers une boutique active pour créer des ventes ou des colis. La vérification de l'hébergement combiné est décrite dans les scripts et la chaîne GitHub Actions.

Ne jamais enregistrer dans le dépôt les fichiers `.env`, clés, exports clients, sauvegardes, rapports privés, images téléversées ou résultats générés. Les comptes applicatifs doivent disposer de permissions PostgreSQL limitées ; le rôle de test n'est pas un compte de production.

## Sécurité et limites de la protection web

Les pages Next en hébergement normal ou combiné reçoivent une politique de sources, une interdiction d'encadrement, `nosniff`, une politique de référent et HSTS. Les sources nécessaires aux photos et au Pixel sont conservées. Cette première politique conserve les scripts inline requis par le rendu Next ; ce n'est pas une CSP stricte à nonce et elle ne remplace pas les contrôles serveur ou un audit de sécurité.

Les permissions, la révocation des sessions et la récupération de mot de passe existent. La migration des jetons administrateur hors de localStorage et la double authentification propre au dashboard restent des évolutions à réaliser ; elles ne doivent pas être annoncées comme actives.

## Livraison à un autre marchand

Avant livraison : installation neuve, personnalisation de marque, paramètres et droits validés, réception des e-mails vérifiée, sauvegarde hors serveur et restauration testées, recette sur de vrais appareils, formation et modalités de maintenance convenues. Conserver une révision du code identifiable et une procédure de retour arrière.

Les conditions de licence, de redistribution ou de cession du code doivent être formalisées avec le propriétaire. Ce dépôt n'inclut pas actuellement de fichier de licence principal. Les dépendances conservent leurs licences propres ; les droits des photos et de la marque doivent être vérifiés séparément avant réutilisation commerciale.
