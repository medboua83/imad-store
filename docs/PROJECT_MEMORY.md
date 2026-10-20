# Imad Store — Persistent Project Memory

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

## Premier contact WhatsApp — déployé et vérifié le 19 octobre 2026

PR boutique #29 fusionnée (`77b1163`) et correctif CRM privé #5 fusionné (`6ab8bc664`, image testée `saas-ad41d981d`). Les trois services CRM sont sains ; configuration, identités et retour des confirmations conservés. Signature HMAC dédiée raccordée à la source existante, transmission boutique réactivée et règle existante de premier contact activée. Routeur partagé inactif ; agent conseil archivé avec versions conservées ; agent de confirmation seul sur le numéro réservé.

Recette réelle autorisée : deux commandes distinctes fictives marquées NE PAS EXPÉDIER. Une première tentative a respecté la prise en charge humaine existante. Après restitution autorisée du contact, la tentative de la seconde commande a été reprise via le moteur métier, avec l’événement original et tous les contrôles conservés. Résultat : un prospect par référence, un seul message initial pour la seconde commande, statut WhatsApp `delivered`. Les réponses du propriétaire sont traitées par l’agent de confirmation ; les traces attribuées à un agent ne montrent que cet agent. Aucune troisième commande, paiement ou création de colis. Les anciennes commandes réelles ne sont pas rejouées.

Après le test aller-retour et accord explicite du propriétaire, le canal a été ouvert aux clients ; l’interface affiche « L’IA ouverte au public ». La liste de test ne limite plus les réponses entrantes. Le premier contact sur commande exige toujours la demande d’assistance reçue dans la capture signée. Les demandes d’assistance explicites, les oppositions, le traitement humain, les budgets et la validation humaine avant livraison restent appliqués. Les échecs précédents restent visibles dans l’activité ; ils ne constituent pas des prospects supplémentaires.

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

Updated 2026-10-18. This document describes an observed development state, not a production certification.

## Architecture
- Monorepo: Next.js frontend in `apps/web`, Express/TypeScript backend in `backend`, Prisma and MongoDB replica set.
- Development ports: frontend 3000, backend 4000, MongoDB 27017.
- Source code used during testing: `/Users/jobamafa/Downloads/imad_crm_phase01/candidates/phase08-20261017T115243Z-42791` (local Mac path; not portable).
- Backend Prisma schema: `backend/prisma/schema.prisma`.

## Earlier functional observations (2026-10-18; historical)
- Products collection: 11 ACTIVE products, of which 10 are labeled `[TEST 19A]`; these 10 have no images and no variants. Their test categories were all assigned to Bags. These are synthetic test records, not ready for commerce.
- `/api/products` returned HTTP 200 with 11 items; user confirmed catalog visibility subsequently.
- DeskcommCRM integration via encrypted config, order outbox, and periodic worker; observed TICK/ACTIVE markers at ~15-second spacing.
- Read-only outbox audit: 7 entries, 5 SENT and 2 old PENDING, no duplicate order IDs in outbox. Newest test order `6ad5036598784c2e0d8d032c` SENT with 1 attempt; user confirmed CRM receipt. CRM-side uniqueness remains to be independently checked.
- Historical PENDING records must not be replayed. Last confirmed launch cutoff: `2026-10-18T00:00:30.000Z`. Before starting a backend, verify its current configuration rather than assuming persistence.

## Safety
- Never commit secrets or user/customer data to Git.
- Do not execute `prisma db push` on the active MongoDB database; manually managed partial unique index for order idempotency may be affected.
- No automatic sending of old orders or webhooks; maintain explicit approval for live delivery tests.
- Every phase should emit a new, uniquely named TXT report, without overwriting prior reports.

## Git sync status

The synchronization and browser corrections were merged through PR #2 into Master on 2026-10-18. The corrected frontend was subsequently copied to the active local application with backups. Old preparation reports describing an unpushed candidate are historical.

## Synchronization follow-up — 2026-10-18

The prepared candidate was copied into an isolated workspace, compared with the local source, and corrected until the frontend production build and backend typecheck passed. No active runtime or database changes were applied. See CURRENT_STATUS.md for verification limits.

## Browser QA follow-up — 2026-10-18

Read-only browser testing used the existing API with an isolated frontend on port 3100. Fixed API access, mock homepage cart entries, missing standalone image rendering, contact navigation, checkout field labels and shipping mismatch. Test-only catalog records were retained. No successful checkout or CRM delivery was attempted. API_UPSTREAM_URL selects the same-origin proxy target at build time; defaults to the local API on port 4000. Explicit NEXT_PUBLIC_API_URL overrides the browser base URL and requires matching backend CORS configuration.

## Authorized checkout verification and subsequent audit — 2026-10-18

After explicit user authorization, one synthetic checkout was submitted. One local order, one outbox event sent on its first attempt, one CRM receipt and one pipeline lead were observed. The received reference, product, quantity and total matched. No forced replay or retry test was performed; historical pending entries remained unchanged. The synthetic order was retained as pending and reserved one unit of stock.

A later audit, documented in AUDIT_SITE_2026-10-18.md, identified 21 open findings and updated ROADMAP.md. Audit checks were read-only apart from a temporary browser cart addition that was removed. The audit did not implement the proposed application fixes. Dependency warnings are package-lock findings and require configuration-specific triage. Performance targets in the report are proposed acceptance criteria, not measured scores.

## Priority remediation (2026-10-18)

The ten P1 findings are implemented; see `docs/PRIORITY_FIXES_2026-10-18.md` and `docs/CURRENT_STATUS.md` for test evidence and operational limits. Dependency migration was explicitly authorized with backup and tests. Active demo/test fixtures are now DRAFT; optional `inventoryReserved` and `verifiedAt` fields preserve safe treatment of historical records. Never infer legacy stock reservations or reactivate unverified Telegram links.

## Usability and performance remediation (2026-10-18)

The remaining eleven audit items have been implemented and verified with twenty isolated scenarios and browser checks. See docs/USABILITY_PERFORMANCE_2026-10-18.md. Site content uses an explicit draft/publish/rollback collection; never publish guesses about commercial terms. Demo seeding is no longer a startup option and requires an isolated test database. Shared package runtime now uses compiled CommonJS output, built before the backend.
