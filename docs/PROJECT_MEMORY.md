# Imad Store — Persistent Project Memory

## Confirmation détaillée vers le CRM — candidat du 23 octobre 2026

Les nouvelles sorties conservent la langue du checkout et les variantes effectivement liées aux lignes de commande dans la transaction : couleur FR/AR, taille, quantité et prix historique. Champs scalaires order_recap et order_item_N bornés à 2 000 caractères, maximum 30 lignes pour rester sous les 60 champs de capture. Numéro client, téléphone, adresse, code postal, remarques, frais et total sont transmis sans nouvelle requête catalogue. Les anciennes sorties restent inchangées en base ; aucun rejeu. Les confirmations SITE, politique de service, signature et clés idempotentes sont conservées.

Vérifiés : 12 tests locaux formulaire/assistance, génération Prisma sans connexion à une base, compilation du paquet partagé et TypeScript backend réussis. Simulation croisée avec le sérialiseur réel, les limites de capture CRM et le rendu FR/AR : chaque variante et montant présents, une seule question, accord reconnu par la garde de colis. CI MongoDB et installation du site restent à observer ; aucune commande, aucun WhatsApp ni colis envoyé par la recette. Validation humaine avant expédition conservée.

## Repeated base pack with exact overrides — 23 October 2026 owner clarification

Priority: (1) an explicit merchant price for the exact total product quantity wins, even if base-pack decomposition is cheaper; (2) otherwise repeat the smallest configured pack, plus loose pieces at the original price; (3) without offers use ordinary pricing. At base 230 and a pair for 400, totals are 230/400/630/800/1030. Other configured quantities are exact overrides, not a reason to combine or extend other offers. Both admin fields remain blank for new rows; display only entered offers, never manufacture promotion schedules. The old minQuantity JSON name remains the number of pieces in a pack, with no schema migration.

quantityPriceBreakdown exposes packs, looseQuantity and whole-cent allocations. priceCart distributes actual pack-priced units then original-price loose units across variant rows, preserving each row’s quantity and the exact total. Odd loose units must not be averaged into discounted server snapshots. Only fractional-cent pack prices split internally into adjacent cent values. UI may show a clearly labelled average but includes the actual price breakdown. Preserve existing order/outbox snapshots, cancellation totals, stock CAS and idempotence. This priority replaces earlier exact-only or proportional-threshold interpretations.

## Manual exact quantity offers — 23 October 2026 correction

The merchant enters each quantity and its total independently. New offer rows start with both fields blank. Admin summary lists only entered offers; never manufacture 1–5 promotion totals or suggest another lot price. The historical JSON minQuantity now means EXACT quantity: find equality, never >=. Legacy unit-only records still provide the price for that exact count only. No matching offer = base price × count, without pack decomposition, remainder pricing, extrapolation or repeat-bundle discounts. Independent offer rates may increase relative to another offer, but never exceed the ordinary product price. A 2/400 offer at base 230 does not set 3/600: the latter is 690 until explicitly entered.

Apply this same shared rule to product preview, variant aggregation, cart, checkout and server snapshots. Preserve all saved order/outbox snapshots and idempotent replays; no data migration, commercial record rewrite or product write is needed. Earlier candidate sections describing minimum thresholds/nonincreasing schedules/proportional extension are superseded by this rule.

## Product quantity buttons — 23 October 2026 candidate

Quick choices 1/2/3 plus larger configured thresholds select the actual number to add for the chosen variant. Disable choices above remaining stock after subtracting that variant’s existing cart quantity; clamp the displayed/addable quantity together. Never silently advertise an addition that will be truncated by the cart. The main total uses quantityTotalPrice at the combined product quantity, across variants. When some units already exist, explicitly label the total after addition and show existing + new = combined. The purchase bar mirrors that exact product total, excludes other products/shipping, and never substitutes an approximate unit price for the authoritative total. Ordinary products also support the shortcuts, without fabricated discounts. Preserve photographs, merchant prices, allocation arithmetic, server reservation and order idempotence.

## Product builder and pack totals — 23 October 2026 candidate

Quantity tier JSON remains backward compatible: unitPrice stays required for legacy clients, optional totalPrice preserves the merchant's exact reference-quantity total. Validate consistency, positive whole-cent totals and nonincreasing average rates. New total-based tiers may equal the ordinary price (1=200,2=400). Old unit-only discounted schedules remain supported. priceCart rounds each product's aggregate total once and allocates whole cents across its units; server snapshots those allocations as order lines, never an extra order/outbox. Cancellation must restore the summed quantity once. Preserve stock CAS and idempotent historical snapshots. Display an approximate average unit price when cents cannot divide evenly, with the exact line/order total authoritative.

Admin edits total per quantity, with a live 1–5 preview. Main editor has section navigation and readiness summary. Only new products auto-suggest their slug; manual edits and existing URLs remain authoritative. New blank SKU references derive from the stable draft key and slug; never regenerate an existing variant's identity. Blank English names explicitly fall back to French. No schema migration or production catalog rewrite. See the current PR for final validation/deployment status.

## Quantity offers — 23 October 2026 candidate

Optional per-product quantityDiscounts JSON: up to five decreasing unit-price tiers, minimum quantities 2–100. Sum all variants/aliases of the same product; never mix unrelated products. The highest reached tier applies to all its units and replaces the current unit price without subtracting compareAtPrice. Shared integer-cent calculation drives basket and checkout; server catalogue remains authoritative and snapshots discounted unitPrice in order/outbox. Delivery threshold uses discounted subtotal. Missing legacy field means no quantity offer. Admin can add/remove tiers, with no production offer enabled by default. Generate Prisma only; no db push or historical rewrite. Local 85 tests and builds/lint passed; CI includes mobile/desktop buyer and admin coverage. See the PR for final CI/deployment state.

CI uses the preinstalled Chrome channel on pinned Ubuntu 24.04, after two runs stalled downloading Ubuntu font/dependency packages for more than six minutes. Browser version preflight must succeed; all UI tests and subsequent installer/business/combined-runtime/audit checks remain mandatory. Local Playwright defaults to bundled Chromium; PLAYWRIGHT_CHANNEL=chrome explicitly selects a locally installed Chrome in an isolated test profile. No user browser profile is reused.

## Conserver les photographies originales — 23 octobre 2026

Le marchand a annulé la retouche générative des photos puis demandé uniquement une amélioration de leur présentation. Ne jamais substituer les essais générés aux originaux. Le cadre doré doit rester une présentation CSS : sources, ordre, pixels et couleurs des fichiers préservés. Garder `object-fit: contain` dans la galerie, les miniatures, l’agrandissement et les photos du panier, sans filtre d’image ni effet de survol qui découpe la photo.

Même règle pour les petites photos de catégories : seules leurs bordures sont harmonisées dans `photo-presentation.css`. Conserver les cinq images `images/categories/*-v2.webp`, leur résolution et le routage existant ; ne pas réintroduire les catégories vides pour modifier la présentation. Les dimensions compactes de l’accueil, du menu et des filtres restent préservées.

## Navigation et tunnel internes — 23 octobre 2026

`publishedCount` compte les produits ACTIVE avec image, hors slugs de recette exclus du catalogue public. Les interfaces marchandes gardent toutes les catégories ; la navigation publique filtre ce compte. La recherche de ville ne doit produire que les valeurs canoniques de SHIPPING_CITIES et ne doit jamais remplacer la ville sélectionnée à la frappe.

Les événements analytics panier et commande sont dédupliqués par portée d’installation ; ne pas réutiliser leurs identifiants pour le Pixel. Le suivi des états est une photographie actuelle, sans reconstitution des anciennes commandes, sans preuve de paiement, et ne concerne que les commandes attribuées à une visite. Toute écriture statistique après une transition métier est facultative : préserver impérativement le succès de la transaction métier si cette écriture échoue. Les compteurs confirmation/expédition incluent les étapes suivantes et excluent les annulations ; leurs libellés l’expliquent.

Les horodatages du résumé CRM proviennent de l’outbox SENT et des reçus de retour acceptés, sans dévoiler leurs contenus. Garder la distinction entre service programmé, envoi accepté, confirmation client, expédition et paiement. L’IA reste pilotée dans l’administration. Aucun ancien envoi rejoué par cette amélioration.

## Pointures et hydratation du panier — 23 octobre 2026

Une variante doit représenter une seule taille. `isAmbiguousSize` est partagé par administration, API, panier et réservation : les variantes historiques ambiguës restent dans la base et dans l’administration pour rapprochement, mais sont retirées de la vente. Ne jamais répartir leur stock sans inventaire réel fourni par le marchand. La copie locale isolée de cette intervention se trouve dans `work/imad-audit-priorities`, basée sur Master d66e5e4 ; ne pas écraser les autres copies de travail.

Zustand persist doit conserver `skipHydration: true` et être réhydraté dans Providers après montage. Les méthodes `itemCount()` et `total()` lisaient l’état déjà restauré pendant l’hydratation, causant React 418 dans CartDrawer. La recette doit toujours inclure un panier préexistant et un rechargement complet, en plus des sessions vides. Voir CURRENT_STATUS pour les limites commerciales encore en attente de données exactes.

## Formulaire compatible Olivraison — candidat du 23 octobre 2026

Le checkout propose les 355 villes du catalogue officiel relu le 23 octobre à 03:01 UTC. Les libellés arabes courants gardent la valeur canonique transporteur (Tanger/طنجة → tangier). Nom complet 3–120 caractères, téléphone marocain normalisé côté serveur, adresse complète 5–124 caractères sans troncature. Le serveur refuse une nouvelle commande incompatible avant stock/outbox ; les empreintes brutes et relectures idempotentes historiques sont conservées. La ville et les coordonnées enregistrées alimentent le récapitulatif et le webhook ; total COD et frais restent calculés par le serveur, sans changement tarifaire.

La politique d’assistance administrative de la PR 58 est préservée : aucune réintroduction de case de consentement au checkout ni modification du réglage marchand. Aucun transporteur indépendant activé. Le catalogue embarqué n’est pas une synchronisation périodique : le CRM vérifiera la ville sur /cities en direct avant toute nouvelle réservation. Une ville retirée doit être corrigée, jamais remplacée par approximation. Pour mettre à jour les choix, relire /cities côté serveur avec les clés existantes puis régénérer et tester packages/shared/src/shipping-address.ts sans exposer les clés.

Vérifiés localement avant intégration : 14 tests unitaires ciblés réussis, compilation shared/backend et lint web réussis. La suite MongoDB/UI complète et le déploiement restent à observer. Aucun ordre réel, WhatsApp, colis ou ramassage envoyé pour cette recette ; validation humaine avant expédition conservée.

## Assistance IA pilotée par le tableau de bord — candidat du 23 octobre 2026

La case WhatsApp et son reçu de consentement sont retirés du checkout. Intégration CRM propose un interrupteur administrateur persistant, initialement désactivé. Le serveur conserve une instruction de service versionnée distincte du consentement client, dans la même transaction que la commande. Le sender vérifie aussi le réglage actuel pour bloquer une demande encore en attente après désactivation. Une réactivation ne transforme pas les commandes créées pendant l’arrêt. Le mode SITE supprime la demande de confirmation IA. Les anciennes captures ne sont pas réécrites ; les anciens clients avec véritable accord restent compatibles tant que le nouveau réglage n’a pas été enregistré.

Le CRM doit reconnaître order_service_requested et la version store-order-service-v1-2026-10-19, avec sa propre règle de suivi activée. Ne pas publier la boutique seule avant cette mise à jour coordonnée. Aucun accord client fabriqué. Tests et publication consignés dans le rapport local.


## Nom de commande pour le CRM — candidat du 22 octobre 2026

Le récapitulatif transmis inclut désormais explicitement « Client de la commande » avec le nom saisi au checkout. Le premier contact pourra ainsi privilégier ce nom au profil WhatsApp déjà enregistré. Aucun identifiant, consentement, commande historique ou action transporteur modifié. Neuf tests formulaire/consentement et compilation backend réussis ; nom français/arabe et corps JSON signé couverts par les assertions. CI et installation à vérifier dans la PR et la mémoire CRM ; aucun WhatsApp ni colis de test.

## Adresse et numéro client CRM publiés — 22 octobre 2026

PR nº 54 fusionnée : 4e19e8092bdffa60d7cfa8687a13e1110503b86e. CI complète réussie, dont le JSON signé reçu par un simulateur local avec rue, ville, région et numéro public ; neuf tests locaux et compilation backend réussis. Hostinger observé Completed / Current sur ce commit ; /health répond ok. La règle native CRM a été enregistrée puis relue : premier message unique commande + adresse et numéro public ; deux aperçus réels du générateur, fictifs, FR/AR réussis sans envoi WhatsApp ni création de colis. Validation humaine avant expédition conservée ; aucun ancien événement rejoué. Les sections de candidat plus anciennes décrivent leur état au moment de leur rédaction. Voir CRM_DELIVERY_ADDRESS_2026-10-22.md.

## Adresse et numéro public transmis au CRM — candidat du 22 octobre 2026

Le sérialiseur webhook omettait la rue pourtant enregistrée par le checkout et la file de sortie. Il transmet désormais dans message l’adresse, la ville et la région, avec le numéro public affiché au client (suffixe de huit caractères en majuscules). pedido_id, clés d’événement, accords WhatsApp et mode SITE inchangés. Aucun ancien événement rejoué ni colis créé. Neuf tests formulaire/consentement et compilation backend réussis ; assertions du JSON signé ajoutées à la recette MongoDB isolée de CI. Publication/déploiement à vérifier séparément. Voir CRM_DELIVERY_ADDRESS_2026-10-22.md.


## Confirmation directe sur le site — candidat du 22 octobre 2026

Paramètres → Gestion des commandes : option persistante désactivée par défaut. Lorsqu’elle est activée, le checkout arabe ajoute une relecture complète modifiable, puis une validation finale. Le serveur vérifie le mode et les montants, crée une commande CONFIRMED avec confirmationMethod=SITE et confirmedAt, et neutralise la demande d’assistance de confirmation WhatsApp. Les notifications et la file CRM restent en place ; seuls les nouveaux événements SITE incluent confirmation_method, confirmed_at et confirmation_required=false. Le sender force aussi ai_service_consent=false pour SITE, en JSON signé comme dans le formulaire historique. Aucune ancienne commande ni file existante réécrite.

La confirmation n’est ni une vérification du téléphone ni une garantie de livraison. Le statut métier reste compatible avec les actions administrateur et le retour CRM. Le défaut absent/false conserve le checkout, la capture d’accord WhatsApp, le statut PENDING et le protocole des anciens événements. La clé d’idempotence et la garde synchrone côté client protègent double clic et reprise réseau. Pas de db push, fusion ou déploiement de ce candidat sans nouvelle autorisation. Les règles externes CRM personnalisées ne sont pas éditées par cette PR.

Validation locale : génération Prisma, compilation backend/frontend, lint, cinq tests Playwright avec données fictives (390/1440 px, relecture/modification, double clic, erreur réseau, réglage ON/OFF), sept tests de consentement/formulaire CRM et audit sans vulnérabilité. Le scénario MongoDB isolé couvre persistance, autorisations, activation/désactivation, montant incorrect, concurrence, métadonnées, compatibilité historique, webhooks signés et transitions manuelles. Résultat de la CI consigné dans la Pull Request ; aucun test ni message envoyé aux services de production.


## Corbeille des commandes — candidat du 21 octobre 2026

Suppression réversible des seules commandes annulées sans réservation de stock active : action individuelle et groupée sur la sélection affichée, corbeille paginée et restauration. Le serveur exclut les documents marqués de la liste administrative et de ses compteurs ; les anciens documents sans champ deletedAt restent visibles. Opération atomique, droits administrateur et journal des déplacements/restaurations. Les commandes, articles, paiements, stocks, fichiers CRM et reçus restent conservés. Aucune nouvelle transmission ni rejeu CRM. Le suivi invité conserve le statut annulé.

Génération Prisma uniquement ; aucun db push ni index modifié. Pour un test encore actif, utiliser d’abord l’annulation existante avec ses contrôles de réservation, puis la corbeille. La sélection groupée ne devine jamais les commandes de test à partir d’un nom ou numéro. Le retrait ne supprime pas les prospects déjà transmis au CRM ni les données des services externes.

Compilation backend, lint et compilation/typecheck frontend réussis. Un scénario d’intégration couvre les accès, lots mixtes refusés, anciennes commandes sans champ, répétition, exclusion/restauration, audit et préservation stock/outbox. MongoDB local est indisponible dans cet environnement (démarrage refusé) : validation de ce scénario confiée à la CI isolée avant publication. Aucun nettoyage en production effectué à ce stade.


## Textes inclusifs — 20 octobre 2026

À la demande du propriétaire, les textes publics arabes utilisent une adresse collective pour les femmes et les hommes : accueil, menu, catalogue, fiches, panier, commande, aide, consentement Pixel et métadonnées. Les catégories Homme/Femme et les descriptions du catalogue restent inchangées. Les valeurs par défaut du contenu sont adaptées ; les contenus personnalisés enregistrés en base restent prioritaires. PR #38 publiée au commit c7f08a98, Hostinger Completed/Current vérifié le même jour ; frais 30 DH, seuil 500 DH, Pixel désactivé sans identifiant. Aucun produit ni réglage commercial réécrit.

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

## Accord WhatsApp à la soumission — candidat 20 octobre 2026

Voir WHATSAPP_CONSENT_SNAPSHOT_2026-10-20.md : capture exacte de la case avant attente, contrôles serveur et reçu client, sans consentement précoché ni reprise historique. Tests ciblés, lint frontend et compilation backend locaux réussis ; recette complète et publication encore à vérifier.

### Olivraison integration (2026-10-22, not deployed)

The carrier integration is opt-in through admin settings and depends on direct-site-confirmation PR #48. Queue only newly created orders after activation, at CONFIRMED, inside the order/status transaction. Use fixed partners.olivraison.com API, orderId idempotency, no carrier inventory reservation, owned tracking IDs for pickups, and preserve uncertain-pickup checkpoints. Never equate delivered COD with remitted payment. Do not backfill, replay or use account-wide pickup wildcards. Documentation: docs/OLIVRAISON_AUTOMATION.md.

## Société de livraison unique — 22 octobre 2026

Le formulaire Olivraison est masqué après sauvegarde et au rechargement lorsqu’une configuration existe, même désactivée ou sans clés. Le récapitulatif propose Modifier et Supprimer avec confirmation. Modifier recharge les valeurs enregistrées sans exposer les secrets ; Annuler abandonne les changements. DELETE administrateur efface le document et les clés, conserve les commandes/colis et refuse les colis non terminés. Une écriture transactionnelle partagée avec la mise en file évite la suppression concurrente à une nouvelle expédition. Aucun appel transporteur ni suppression de données de production pendant les tests.

Compilation backend/frontend et lint réussis. Tests UI 390/1280 px et intégration ajoutés ; résultats finaux dans le rapport de cette intervention.

## Aperçus produits — 22 octobre 2026

Diagnostic public : og:image et twitter:image pointaient vers http://localhost:3000/uploads alors que les photos étaient servies sur le domaine public. Les métadonnées utilisent maintenant SITE_URL ou le Host public de la requête (HTTPS hors boucle locale), avec nom, description, URL canonique et image absolue explicites pour Open Graph/Twitter. Même source produit serveur pour les fiches actuelles et futures. Aucun logo générique ajouté à une fiche sans photo. Tests ciblés origine multi-installation et cartes par produit ; caches externes à rafraîchir après publication.

## Retrait Olivraison avec colis en cours — 22 octobre 2026

Le propriétaire autorise le retrait des clés et l’arrêt du suivi automatique des deux colis existants, sans annulation chez le transporteur. DELETE conserve les références et documents, place les colis non terminés en DISCONNECTED et empêche leur reprise après reconnexion. Un échange déjà en cours (bail actif) impose seulement d’attendre sa fin. Historique affiché Suivi retiré sans bouton de reprise ; les colis retirés ne bloquent plus un changement ultérieur de compte. Tests : rejet pendant un échange, retrait idempotent, conservation commandes/références, reconnexion sans appel ni reprise historique.

## Saisie guidée des villes transporteur — 22 octobre 2026

Le champ texte ville=ville est remplacé par des lignes Ville sur la boutique / Ville chez Olivraison, avec ajout/retrait et suggestions natives après chargement de la liste Olivraison. Correspondances facultatives, valeurs existantes préservées, contrôle des lignes incomplètes et sources en double ; le format cityMapping et la résolution serveur restent inchangés. Aucun compte transporteur ni appel réel pendant la recette.
