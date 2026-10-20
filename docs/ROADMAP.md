# Roadmap — stabilité, performance et facilité d’utilisation

## Logo IMAD Mode choisi — candidat du 20 octobre 2026

Le logo central de la planche fournie (sous le trait vert) a été isolé/adapté sur fond transparent. Un visuel WebP embarqué de 61 960 octets, partagé par le header, le footer, l’administration et sa connexion, est teinté par masque alpha selon les couleurs existantes : vert profond sur ivoire, ivoire sur vert. Rendu vérifié sur ordinateur et mobile sans débordement, compilation et lint réussis. Voir SELECTED_BRAND_LOGO_2026-10-20.md. La modification complète la PR #38 locale, sans publication en production.


## Promotions, livraison et Meta Pixel — candidat du 20 octobre 2026

Produit : prix initial barré activable et livraison offerte. Administration : frais par défaut 30 DH, seuil configurable (500 DH dans la recette), livraison offerte à tout panier contenant au moins un produit éligible, conformément au choix explicite du propriétaire. Calcul partagé, recalcul serveur et actualisation du panier avant commande. Meta Pixel configurable, désactivé par défaut, chargé après choix publicitaire, sans saisie de code arbitraire. Recette isolée sur le port 3000 et 50 tests réussis ; aucune publication en production ni activation réelle du pixel. Détails : `COMMERCE_OPTIONS_2026-10-20.md`.


## Collection catégories et images administration — 20 octobre 2026

Quatre nouveaux visuels générés sans texte rejoignent les sabots : abayas, chaussures femme, châles et sacs, sur fond ivoire. Fichiers WebP embarqués et communs à l’accueil, au menu et à la boutique. La liste admin essaie les autres photos du même produit lorsqu’une couverture manque ; l’éditeur signale chaque fichier indisponible au lieu d’afficher une icône cassée. Aucun ordre, photo source ou catalogue réécrit. Voir `CATEGORY_COLLECTION_ADMIN_PHOTOS_2026-10-20.md` pour la provenance et les limites.


## Nouvelle vignette Sabots Homme — 20 octobre 2026

Visuel généré choisi et approuvé par le propriétaire : `images/categories/sabots-homme-v2.webp`, embarqué dans le dépôt (640 × 640, 22 442 octets), sans texte. Le choix de présentation de cette catégorie est prioritaire sur son ancienne couverture, partagé par l’accueil, le menu et le filtre boutique. Les images de produits restent distinctes. Provenance et validation : `SABOTS_CATEGORY_PHOTO_2026-10-20.md`.


## Missing homepage cover — 20 October 2026 candidate

See `HOME_IMAGE_FALLBACK_2026-10-20.md`. A newly chosen missing cover broke the hero and custom category photo. Extend the existing product-image fallback to these locations, banners and cart lines; prefer images of the same product/category. Recognize nested Hostinger runtime roots and verify explicit shared upload storage with an unbundled upload across deployment. Original missing references stay intact. Statistics PR #34 is already published and verified separately.


## Visitor statistics — 20 October 2026 candidate

See `STORE_ANALYTICS_2026-10-20.md`. Admin Statistics adds 7/30/90-day visits, per-product consultations and visit-to-created-order conversion. First-party ephemeral measurement, server-derived company/store scope, private admin summaries, test/admin/privacy exclusions, duplicate protection and 91-day TTL retention. Committed orders remain successful when analytics fails. No historical backfill, schema push or production test order. Forty-four integration/client tests and combined-hosting tests pass; isolated browser journey produces one converted visit. Publication is verified separately.


## Durable product photos — 19 October 2026 candidate

See `PRODUCT_PHOTO_STORAGE_2026-10-19.md`. Recover the exact cached Saboliya main photo, preserve the three missing original references, skip unavailable images in cards/gallery, and resolve Hostinger media outside replaceable releases. Explicit UPLOAD_DIR remains authoritative. Storage regression tests cover successive releases and domain separation; hosted tests verify the recovered photo over HTTP. Publication and browser verification are tracked separately. No catalogue, order or CRM writes.


## Boutique et filtres mobiles — candidat du 19 octobre 2026

Page boutique remaniée : navigation de catégories avec petites photos, panneau GET unique recherche/catégorie/tri/prix/stock, filtres actifs supprimables individuellement et remise à zéro. Changer de catégorie conserve les autres critères ; toute modification retire la pagination. Les cartes montrent les couleurs et tailles ayant du stock, le prix et un accès clair aux détails ; une carte seule utilise la largeur mobile disponible. Aucun ajout direct au panier sans choix de variante. Le propriétaire demande explicitement le retrait du texte « صورة توضيحية » sur les vignettes : surimpression supprimée, provenance des visuels conservée dans le dépôt.

Lint, TypeScript et compilation frontend réussis ; recette Chrome locale avec lectures publiques uniquement : six filtres combinés, retrait individuel avec conservation des autres, zéro résultat puis remise à zéro, prix inversés signalés. Aucun ordre ni message créé. Compilation locale liée : même avertissement de traçage standalone hors racine, sans modification de dépendances ou du serveur. Le contrôle GitHub complet et la publication sont à vérifier séparément. La PR #31 précédente est déployée en production au commit 457ec914, vérifié Hostinger Completed/Current et Chrome 360/390/1470 px.

## Présentation des catégories et réseaux sociaux — candidat du 19 octobre 2026

Branche isolée `design/category-social-polish` : petites vignettes photographiques rondes (96 px bureau / 76 px mobile, 42 px menu), titres arabe/français, grille mobile visible sans défilement horizontal, vignettes dans le menu et icônes locales des quatre réseaux sociaux. Liens sociaux conservés ; cartes produits et zones tactiles affinées. Une image de catégorie personnalisée remplace le visuel générique Cloudinary ; à défaut, priorité au produit publié puis aux illustrations existantes, explicitement signalées en arabe. Le propriétaire demande de vraies photos ; les photos des autres marchandises restent à fournir, sans présenter les illustrations générées comme des photos réelles.

Validation : lint frontend, typage et compilation frontend réussis ; Chrome local avec données publiques uniquement, cinq images chargées, grille à 390 px, catalogue à 360 px et accueil à 1470 px sans débordement, menu fermé après navigation vers la catégorie Sabots Homme, liens sociaux conservés et boutons de 56 px. Aucun changement de données ni commande créée. Le build local avec dépendances liées signale des fichiers de traçage standalone hors racine ; cette recette valide le frontend et son rendu, pas un paquet standalone autonome. Publication sur Quickydev non effectuée à cette étape. Les modifications CRM/WhatsApp en cours restent dans l’autre branche.

## Premier contact WhatsApp — candidat du 19 octobre 2026

Le propriétaire souhaite le premier contact automatique sur les prochaines commandes admissibles et choisit l’agent Imad de confirmation sur son numéro dédié. Le candidat ajoute une demande WhatsApp explicite (sans réglage CRM côté client), une preuve atomique et versionnée, une signature entrante chiffrée configurable et un JSON typé avec référence stable. Les événements historiques conservent leur protocole ; aucune autorisation ou référence ajoutée rétroactivement. Documentation : `docs/WHATSAPP_ORDER_CAPTURE_2026-10-19.md`.

40 tests d’intégration jetables et 6 tests du kit ; compilation, lint et contrôle négatif restauré. Recette Chrome locale : numéro local refusé pour assistance, commande fictive avec choix/version/date, signature sauvegardée sans réaffichage. Aucun WhatsApp, activation ou rejeu en production à ce stade. Le CRM candidat corrige le comptage des publications anciennes, tout en exigeant un seul agent actuel et aucun routeur actif.


## Kit d’installation par entreprise — 19 octobre 2026

Le générateur produit un profil privé, une fiche CRM privée avec signature dédiée et une procédure propre à l’installation. Envoi CRM en pause par défaut. Le lanceur `store:run` charge le profil explicitement, refuse les `.env` hérités et ne transmet pas les variables applicatives du terminal. `store:bundle` prépare une archive du code commité sans profil, dépendances, historique ou données locales. Guide : `docs/STORE_INSTALLATION_KIT.md`.

Validation : 6 tests du kit et 39 tests d’intégration MongoDB jetables réussis ; création du premier administrateur par le lanceur réussie et seconde création refusée. Aucun nouvel accès, entreprise ou envoi en production. Le modèle exige encore domaine/base/stockage dédiés et personnalisation visuelle/commerciale ; il n’est pas une installation SaaS partagée ni un déploiement automatique. La connexion de commandes n’active pas le premier contact IA/WhatsApp.


Validation complémentaire du kit : archive `c2a92f1` extraite dans un dossier neuf, `npm ci --include=dev` et compilation complète via `store:run ... build` réussis. Démarrage combiné sur port isolé 3117, `/health` sain et accueil observé dans Chrome ; base avec un administrateur, zéro produit et zéro commande. Trois tests du serveur hébergé réussis. Contrôle négatif des identités détecté, code restauré. CI GitHub de la PR #28 réussie. Aucune donnée de Quickydev reprise.

## Liaison historique vérifiée en production — 19 octobre 2026

Publication Hostinger de la PR #26 vérifiée sur quickydev.com (fusion `8a970e622c2c438c0ca3346596bbba255899c9cd`). Le CRM publié `saas-4b66faca1` rattache la source et la règle existantes, sans autre connexion, nouvelle clé ou identité d’installation inventée. L’administration boutique explique cette installation historique ; les nouveaux profils affichent leur identifiant en lecture seule avec copie.

Commande fictive **3777E1A2** : envoi en une tentative, une réception et un prospect dans le CRM, numéro local correctement transmis en +212 ; confirmation depuis le CRM revenue automatiquement sur la seule commande filtrée. Paiement resté en attente. Aucun envoi WhatsApp, appel IA ou colis. Les 39 tests MongoDB jetables, la compilation isolée et les trois protocoles du serveur hébergé restent applicables au code inchangé. Les sections de candidat ci-dessous sont historiques.

## Identité administrative et numéros CRM — candidat du 19 octobre 2026

L’administration précise qu’une installation historique ne possède pas d’identifiant de boutique. Les nouveaux profils affichent leur identifiant en lecture seule avec copie ; aucun identifiant de source ou de commande n’est présenté comme une identité d’installation. Le CRM peut rattacher le circuit historique existant sans créer une source supplémentaire ni adopter une base remplie. Aucun réglage de production modifié par ce code seul.

Le formulaire CRM sortant normalise les numéros marocains locaux en +212 ; les valeurs déjà internationales sont conservées. Aucun ancien contact ni événement de file n’est réécrit. 39 tests d’intégration sur base locale jetable réussis, compilation backend et lint frontend réussis. Compilation isolée combinée et trois tests du serveur hébergé réussis ; publication à vérifier. La validation réelle précédente de la connexion historique utilise uniquement la commande fictive 9BD3D8F8 : un prospect, transmission en une tentative et retour automatique Confirmée ; aucune clé en clair n’a été récupérée ou publiée.

Audit de référence : [18 octobre 2026](AUDIT_SITE_2026-10-18.md). Le lot P1 est implémenté et testé ; voir [les corrections et leurs limites](PRIORITY_FIXES_2026-10-18.md). Le lot P2 est également implémenté ; voir [ergonomie et performance](USABILITY_PERFORMANCE_2026-10-18.md). Les informations commerciales réelles et les mesures terrain restent à compléter.

## Lot 1 — Sécurité et intégrité

- [x] A01 : limiter le suivi invité aux informations autorisées.
- [x] A02 : authentifier les notifications et l’association des numéros Telegram.
- [x] A03 : verrouiller la capacité de paiement inutilisée ; vérifier les montants avant toute activation.
- [x] A04 : centraliser les transitions de commande et la restitution du stock.
- [x] A08 : valider les paramètres API et supprimer les diagnostics internes des réponses publiques.
- [x] A09 : trier les avis de dépendances et appliquer les correctifs sur une branche dédiée.
- [x] A21 : créer une CI avec base et CRM de test isolés, sans accès aux clients réels.

## Lot 2 — Catalogue et administration utilisables

- [x] A05–A06 : formulaire produit complet, variantes/stock et véritable stockage des images.
- [x] A07 : isoler les démonstrations, contrôler la publication et afficher uniquement le catalogue prêt.
- [ ] Catalogue réel : fournir et valider photos, descriptions et variantes avant la mise en vente.
- [x] A10 : contrôler les quantités du panier et les variations de prix/disponibilité.
- [x] A11 : configuration du site persistée côté serveur avec brouillon, aperçu et publication.
- [x] A12–A13 : recherche, tri, pagination et reprise après erreur réseau.
- [x] A19–A20 : sessions administrateur fiables et jeux de démonstration distincts du démarrage de production.

## Lot 3 — Parcours clients plus simples

- [x] A14–A15 : dialogues accessibles, focus clavier, mouvement réduit et lisibilité mobile.
- [x] A16 : métadonnées produit, vraies pages 404, sitemap et règles d’indexation.
- [x] A18 : informations commerciales validées et preuves sociales vérifiées.

## Lot 4 — Performance mesurée

- [x] A17 : établir les mesures de production avant optimisation.
- [x] Réduire les requêtes après hydratation, mutualiser les réglages et charger les onglets lourds à la demande.
- [x] Héberger les polices localement et distinguer cache public et réponses privées.
- [x] Vérifier les régressions sur mobile et ordinateur avec des budgets explicites.

## Règles de validation

Chaque lot doit fournir un résultat vérifiable et une possibilité de retour arrière. Conserver les index MongoDB existants ; ne pas exécuter prisma db push sur la base active. Les tests de répétition utilisent un CRM simulé et ne rejouent jamais les anciennes entrées de la file réelle. Une réception unique précédemment observée ne certifie pas tous les scénarios de panne.

## Après les deux lots

- [ ] Fournir et valider les délais, conditions de retour et identité/adresse commerciale avant publication.
- [ ] Observer les performances terrain après une éventuelle mise en ligne sur le domaine final.

## Reusable company installations — 2026-10-19

- [x] Fresh isolated profile generator, database identity/index bootstrap, encrypted per-company confirmation setup and isolated tests. See COMPANY_STORE_TEMPLATE_2026-10-19.md.
- [ ] Optional future CRM-side self-service provisioning of enterprises, sources and rules; outside this store repository.
