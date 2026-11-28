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

- [Kit d'installation indépendante](docs/STORE_INSTALLATION_KIT.md) : profil privé, base vide, premier administrateur, compilation et démarrage. Le mode autonome ne demande aucun compte CRM ; la variante CRM reste disponible. Le nom, les logos, les couleurs et les coordonnées se personnalisent dans le dashboard.
- [PostgreSQL et hébergement Namecheap](docs/POSTGRESQL_NAMECHEAP_2026-11-06.md).
- [Sauvegarde, vérification et reprise](docs/RECOVERY_OPERATIONS.md).
- [Règles commerciales](docs/COMMERCE_RULES.md).
- [Guide de caisse](docs/CAISSE.md).
- [Permissions, Gmail et utilisation quotidienne](docs/MERCHANT_GUIDE.md).

La procédure courante utilise `npm ci`, `prisma migrate deploy`, puis le serveur combiné Next/Express avec un seul port public derrière le reverse proxy. Suivre le kit avec le profil de l'installation ; ne pas démarrer plusieurs serveurs concurrents en production. Aucun identifiant administrateur universel ne doit être distribué. Ne jamais réinitialiser ou remplir automatiquement une base active.

Les connexions, le SMTP, les tarifs, les conditions et les médias doivent appartenir au marchand de chaque installation. Ne pas copier les profils ni les données d'une boutique pour en créer une autre. Le nom du profil initialise la nouvelle boutique ; la marque, le SMTP et l'identité juridique restent des réglages distincts.

## Développement et vérifications

Après installation des dépendances et configuration d'un environnement isolé :

```sh
npm run check
npm run test:security
npm run test:ui
npm run test:installer
npm run test:delivery
npm test
```

Les tests serveur exigent un cluster PostgreSQL de test local séparé. Son rôle de recette doit pouvoir créer les bases jetables ; `test:delivery` et la suite complète créent aussi un rôle applicatif temporaire limité pour vérifier les véritables permissions d'une installation neuve. Voir le guide PostgreSQL pour `IMAD_TEST_POSTGRES_URL` et la [recette de remise](docs/RESALE_DELIVERY.md). Ne jamais utiliser un profil ou un rôle de production. Les tests d'interface utilisent des données fictives ; ne pas les diriger vers une boutique active pour créer des ventes ou des colis. La vérification de l'hébergement combiné est décrite dans les scripts et la chaîne GitHub Actions.

La recette de démarrage lance le serveur compilé, préparé par `test:integration`. Sur un disque USB local très lent, `IMAD_TEST_STARTUP_TIMEOUT_MS=120000` permet un démarrage à froid borné plus long ; les valeurs admises sont 30000, 60000, 90000 et 120000 ms. Sans cette option, notamment dans GitHub Actions, le délai reste 30 secondes. La création/migration et le nettoyage de la base jetable ont une enveloppe séparée ; le test exige toujours un véritable serveur sain et une boutique vide, sans chargement des SDK optionnels.

Ne jamais enregistrer dans le dépôt les fichiers `.env`, clés, exports clients, sauvegardes, rapports privés, images téléversées ou résultats générés. Les comptes applicatifs doivent disposer de permissions PostgreSQL limitées ; le rôle de test n'est pas un compte de production.

## Sécurité et limites de la protection web

Les pages Next en hébergement normal ou combiné reçoivent une politique de sources, une interdiction d'encadrement, `nosniff`, une politique de référent et HSTS. Les sources nécessaires aux photos et au Pixel sont conservées. Cette première politique conserve les scripts inline requis par le rendu Next ; ce n'est pas une CSP stricte à nonce et elle ne remplace pas les contrôles serveur ou un audit de sécurité.

Les permissions, la révocation des sessions et la récupération de mot de passe existent. Le dashboard utilise des cookies HttpOnly avec contrôle d’origine et sessions révocables ; la présentation locale ne contient plus de clé d’accès pour les nouvelles connexions. Les anciens clients Bearer restent compatibles. Voir [Sessions du dashboard](docs/ADMIN_SESSIONS.md) pour la reprise et les limites. La double authentification TOTP et les codes de secours sont disponibles, à activer personnellement pour chaque compte.

## Livraison à un autre marchand

Avant livraison : installation neuve, personnalisation de marque, paramètres et droits validés, réception des e-mails vérifiée, sauvegarde hors serveur et restauration testées, recette sur de vrais appareils, formation et modalités de maintenance convenues. Conserver une révision du code identifiable et une procédure de retour arrière.

Les conditions de redistribution ou de cession doivent être formalisées avec le titulaire des droits. `LICENSE` réserve les droits existants sur le code spécifique ; il ne s'agit pas d'une licence publique MIT. Voir `DISTRIBUTION_RIGHTS.md` et le modèle de remise. Les dépendances conservent leurs licences propres ; les droits des photos et de la marque se vérifient séparément.

Double authentification personnelle du dashboard : [activation, secours et exploitation](docs/ADMIN_MFA.md).

Préparation et livraison : [recette](docs/RESALE_DELIVERY.md), [guide marchand](docs/MERCHANT_GUIDE.md), [remise client](docs/CLIENT_HANDOVER.md). Les réglages contiennent un bilan privé en lecture seule. `/api/operations/health` expose uniquement un état opérationnel minimal, sans données clients.

Finaliser une installation avec le marchand : [parcours de remise](docs/FINAL_SETUP.md), [affichage du catalogue et des statistiques](docs/STOREFRONT_DISPLAY.md). Ces guides font partie du kit source ; ils ne contiennent aucun secret ou bilan privé de production.

### Media Buyer

Le module `/admin?tab=media` rapproche les dépenses Meta quotidiennes des commandes attribuées et réellement livrées. Connexion en lecture seule, attribution consentie, sources inconnues explicites et recommandations sans modification de budget : voir [le guide Media Buyer](docs/MEDIA_BUYER.md) et [la règle d’attribution](docs/CAMPAIGN_ATTRIBUTION.md).
