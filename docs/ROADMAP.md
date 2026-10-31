# Roadmap — stabilité, performance et facilité d’utilisation

## Erreurs et reprise du checkout — candidat du 31 octobre 2026

Les messages généraux de reprise sont placés avant les champs de livraison. Après une tentative de validation, le focus rejoint le message une fois rendu, avec marge sous le header fixe ; une erreur de chargement en arrière-plan ne déplace pas le focus pendant la saisie. Un nouvel échec identique doit être annoncé à nouveau. Les lignes indisponibles proposent un accès direct au panier pour les retirer, sans devoir trouver le récapitulatif mobile replié. Champs saisis, signature de relecture, clé d’idempotence, prix/stock, validation serveur et envoi CRM inchangés. Aucun nouvel enregistrement des coordonnées dans le navigateur.

La PR 78 est publiée sur Master 7efe5350 : 71 UI et 100 intégration réussis, Hostinger Completed/Current et vrais gestes vérifiés sur les photos originales à 390 px, clavier à 1470 px. Recette et publication du présent candidat à consigner après les contrôles.

## Consultation des photos — candidat du 31 octobre 2026

La galerie ajoute un glissement horizontal volontaire sur mobile, dans la fiche et la vue agrandie, avec seuil et séparation des gestes verticaux. Gestes courts, annulés ou à plusieurs doigts ignorés ; défilement vertical et zoom natif conservés. Flèches du clavier, Début et Fin pour parcourir les mêmes photos, avec focus visible doré ; retour du focus au bouton de zoom à la fermeture. Aucune modification des photos originales, des variantes, des prix, du panier ou des règles commerciales. Recette et publication à consigner après les contrôles.

La PR 77 est publiée sur Master 68a830e6 : 66 UI et 100 intégration réussis, Hostinger Completed/Current, recette à 390 et 1470 px. Filtres invalides et liens de page hors limites corrigés ; les photos et réglages ont été comparés avant/après sans changement commercial.

## Filtres et pagination du catalogue — candidat du 31 octobre 2026

Audit public : une réponse 400 sur des filtres invalides était remplacée par le catalogue entier, sous les critères pourtant affichés comme appliqués. Le candidat conserve la saisie et ouvre le formulaire avec une erreur, sans résultats non filtrés ni faux compteur. Les pannes de service restent des erreurs, jamais un catalogue vide. Un lien vers une page hors limites propose la première page en conservant recherche, catégorie, tri, prix et disponibilité ; un vrai zéro résultat garde son message distinct. Aucun changement de photos, prix, promotions, stocks ou réglages.

La PR 76 est publiée sur Master 0a1e6b5c : 61 UI et 100 intégration validés, Hostinger Completed/Current et affichage 390/1440 vérifiés. Le pic isolé de réactivité du menu n’a pas été reproduit ; aucune cause ni correction spécifique n’est revendiquée. La recette et la publication du présent candidat seront consignées après les contrôles.

## Priorité des ressources et diagnostic — candidat du 31 octobre 2026

Logo du header préchargé comme image, police Cormorant conservée à la demande plutôt que préchargée sur toutes les pages. Première couverture du catalogue seule chargée en eager/high ; les autres restent lazy, sans modifier les fichiers ni les dimensions. Le mécanisme de repli garde les mêmes priorités quand une source échoue. Photos déjà WebP et cache immuable d’un an sur les fichiers nommés par leur empreinte : aucun changement du stockage.

Le mode volontaire ?measure ajoute la largeur/visibilité et décompose INP en attente, traitement et présentation. Console locale uniquement, sans cible DOM, URL, contenu de champ ni transmission. Aucune instrumentation supplémentaire pour les visites ordinaires. Les mesures navigateur et ressources des fixtures sont jointes aux tests UI ; elles ne constituent pas un score Lighthouse ou un percentile de terrain. Le service PageSpeed a répondu 429 pendant cette intervention. Une interaction du menu à 1 240 ms dans le navigateur intégré reste à analyser par attribution, sans l’attribuer arbitrairement au site ni annoncer sa correction.

La PR 75 est publiée sur Master daccf0ad : 55 UI et 100 intégration, installation et hébergement combiné validés. Checkout compact vérifié à 320/390/1440 ; cartes de marque et photos propres aux produits vérifiées en ligne. Conditions commerciales inchangées.

Règles commerciales actuelles : [COMMERCE_RULES.md](COMMERCE_RULES.md). Les notes datées ci-dessous conservent l’historique ; elles ne remplacent pas cette référence.

## Checkout compact et cartes de partage — candidat du 31 octobre 2026

Récapitulatif replié sur mobile, avec total complet et ouverture native au clavier ; détails dépliés par défaut sur ordinateur. Montants, frais, relecture finale, stock et idempotence inchangés. Cartes Open Graph/Twitter spécifiques à l’accueil et au catalogue, logo original repris dans le doré du site ; métadonnées produit indépendantes conservées. Aucune modification des photos ni des données commerciales. Recette et publication à consigner après CI.

La PR 74 est publiée sur Master acc385e3 : 7 tests de récupération, 51 UI, 98 intégration, installation et hébergement combiné validés. Les paramètres réels 3 jours / 3 jours / DELIVERY_TRY_ON ont été enregistrés uniquement sur quickydev.com et vérifiés après rechargement.

## Fiabilité et lisibilité — candidat du 31 octobre 2026

Audit en ligne et reproductions isolées : titre couvert par le header après navigation, ponctuation du téléphone acceptée puis refusée, panier local invalide provoquant une erreur. Correction par marge de défilement liée à la hauteur réelle du header (pas de défilement forcé), nettoyage du téléphone identique à la validation en conservant le format local/international, et restauration du panier limitée aux lignes valides. JSON illisible, stockage indisponible, doublons et données de prix/quantité invalides ne doivent plus faire planter l’interface. Les lignes indisponibles restent affichées pour vérification ; un avertissement accompagne la récupération. Montants recalculés par le catalogue et le serveur, idempotence et historique inchangés.

Catalogue ordinateur raccourci, photos affichées entières dans un cadre carré sans changer les fichiers ; aides aux tailles/prix plus lisibles. Réglages de livraison : trois champs facultatifs deliveryMaxDays, returnWindowDays et returnFeePayer, absents par défaut pour chaque installation. Le marchand a confirmé pour quickydev.com : livraison 3 jours maximum, demande de retour dans les 3 jours suivant réception, frais de retour à la charge de la boutique uniquement si le retour est confirmé pendant l’essayage à la livraison ; après paiement et départ du livreur, frais à la charge du client (DELIVERY_TRY_ON). Appliquer ces valeurs uniquement sur cette boutique après déploiement ; ne jamais les préremplir pour les autres entreprises. Les conditions de produit, l’adresse de retour et le traitement du montant ne sont pas inventés. Aucune commande, sortie CRM ni opération transporteur autorisée par cette recette.

Tests ajoutés : récupération du panier, navigation mobile/ordinateur, téléphone ponctué, administration et rendu public des délais. Vérification finale, CI, publication et enregistrement des valeurs réelles à consigner dans le rapport de cette intervention. Génération Prisma uniquement, sans db push ni migration de données.


## Recommandations manuelles par produit — 23 octobre 2026

Upsell/cross-sell facultatif, initialement désactivé pour tous les produits. Administration → Produits → Modifier → 5 · Recommandations : activer, rechercher et sélectionner jusqu’à quatre alternatives et quatre compléments, ordonner puis enregistrer. Alternatives sous les informations d’achat ; compléments sur la fiche et dans le panier (deux maximum, trois produits sources maximum). Chaque lien ouvre la fiche pour choisir couleur/taille ; aucun ajout ni remplacement automatique, aucune remise supplémentaire.

Le serveur accepte uniquement les identifiants du catalogue de cette installation, interdit auto-références, doublons dans une liste et listes trop longues. Les configurations ne sont pas exposées dans les réponses publiques. Brouillons, archives, articles fictifs, sans photo et stocks non vendables masqués ; compléments déjà dans le panier retirés et listes dédoublonnées. Désactiver conserve la sélection. Une panne de recommandations laisse l’achat disponible. Champ Mongo JSON optionnel, génération Prisma uniquement : aucun db push ni changement de photo, prix, stock ou règles de commande/CRM/transporteur.

Validation locale : 97 tests d’intégration, lint et compilation backend/web réussis. Tests UI mobile/ordinateur et hébergement combiné ajoutés ; CI et publication à confirmer avant clôture. Aucun rapprochement commercial activé automatiquement sur quickydev.com.


## Confirmation détaillée vers le CRM — candidat du 23 octobre 2026

Les nouvelles sorties conservent la langue du checkout et les variantes effectivement liées aux lignes de commande dans la transaction : couleur FR/AR, taille, quantité et prix historique. Champs scalaires order_recap et order_item_N bornés à 2 000 caractères, maximum 30 lignes pour rester sous les 60 champs de capture. Numéro client, téléphone, adresse, code postal, remarques, frais et total sont transmis sans nouvelle requête catalogue. Les anciennes sorties restent inchangées en base ; aucun rejeu. Les confirmations SITE, politique de service, signature et clés idempotentes sont conservées.

Vérifiés : 12 tests locaux formulaire/assistance, génération Prisma sans connexion à une base, compilation du paquet partagé et TypeScript backend réussis. Simulation croisée avec le sérialiseur réel, les limites de capture CRM et le rendu FR/AR : chaque variante et montant présents, une seule question, accord reconnu par la garde de colis. CI MongoDB et installation du site restent à observer ; aucune commande, aucun WhatsApp ni colis envoyé par la recette. Validation humaine avant expédition conservée.

## Audit prioritaire — 23 octobre 2026

- Candidat : pointures ambiguës hors vente sans perte d’historique, générateur de tailles et avertissements administratifs.
- Candidat : correction React 418 sur panier enregistré, fiches structurées et descriptions de secours cohérentes avec les métadonnées.
- Candidat : pages livraison/retour plus lisibles, informations connues reliées aux réglages et procédure de contact.
- À renseigner par le marchand : inventaire réel par pointure, délais de livraison, délai/conditions/frais de retour et mesures de chaque modèle. Ne pas inventer ces engagements ni convertir le stock de la variante erronée automatiquement.
- Avant publication : suite UI et CI complète, puis contrôles publics après déploiement.

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

## Accord WhatsApp à la soumission — candidat 20 octobre 2026

Voir WHATSAPP_CONSENT_SNAPSHOT_2026-10-20.md : capture exacte de la case avant attente, contrôles serveur et reçu client, sans consentement précoché ni reprise historique. Tests ciblés, lint frontend et compilation backend locaux réussis ; recette complète et publication encore à vérifier.

## Société de livraison unique — 22 octobre 2026

Le formulaire Olivraison est masqué après sauvegarde et au rechargement lorsqu’une configuration existe, même désactivée ou sans clés. Le récapitulatif propose Modifier et Supprimer avec confirmation. Modifier recharge les valeurs enregistrées sans exposer les secrets ; Annuler abandonne les changements. DELETE administrateur efface le document et les clés, conserve les commandes/colis et refuse les colis non terminés. Une écriture transactionnelle partagée avec la mise en file évite la suppression concurrente à une nouvelle expédition. Aucun appel transporteur ni suppression de données de production pendant les tests.

Compilation backend/frontend et lint réussis. Tests UI 390/1280 px et intégration ajoutés ; résultats finaux dans le rapport de cette intervention.

## Aperçus produits — 22 octobre 2026

Diagnostic public : og:image et twitter:image pointaient vers http://localhost:3000/uploads alors que les photos étaient servies sur le domaine public. Les métadonnées utilisent maintenant SITE_URL ou le Host public de la requête (HTTPS hors boucle locale), avec nom, description, URL canonique et image absolue explicites pour Open Graph/Twitter. Même source produit serveur pour les fiches actuelles et futures. Aucun logo générique ajouté à une fiche sans photo. Tests ciblés origine multi-installation et cartes par produit ; caches externes à rafraîchir après publication.

## Retrait Olivraison avec colis en cours — 22 octobre 2026

Le propriétaire autorise le retrait des clés et l’arrêt du suivi automatique des deux colis existants, sans annulation chez le transporteur. DELETE conserve les références et documents, place les colis non terminés en DISCONNECTED et empêche leur reprise après reconnexion. Un échange déjà en cours (bail actif) impose seulement d’attendre sa fin. Historique affiché Suivi retiré sans bouton de reprise ; les colis retirés ne bloquent plus un changement ultérieur de compte. Tests : rejet pendant un échange, retrait idempotent, conservation commandes/références, reconnexion sans appel ni reprise historique.

## Saisie guidée des villes transporteur — 22 octobre 2026

Le champ texte ville=ville est remplacé par des lignes Ville sur la boutique / Ville chez Olivraison, avec ajout/retrait et suggestions natives après chargement de la liste Olivraison. Correspondances facultatives, valeurs existantes préservées, contrôle des lignes incomplètes et sources en double ; le format cityMapping et la résolution serveur restent inchangés. Aucun compte transporteur ni appel réel pendant la recette.
