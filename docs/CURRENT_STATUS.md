# Current Status — 2026-10-18

## Création produit et totaux par quantité — candidat du 23 octobre 2026

Le formulaire affiche quatre sections avec navigation directe, résumé de la fiche et repères pour les éléments nécessaires à la publication. Adresse suggérée automatiquement pour les nouveaux produits jusqu’à sa personnalisation ; noms anglais facultatifs avec reprise explicite du français, SKU stable généré seulement pour une nouvelle variante sans référence. Identifiants et contrôles de stock historiques préservés, aucune photo remplacée.

Le marchand saisit maintenant un total du lot : 2 pièces = 400 MAD ou 3 pièces = 500 MAD. Un aperçu 1–5 pièces suit le prix de base et les offres. Les tarifs standards sans remise sont acceptés ; le prix moyen ne peut pas augmenter avec les paliers. Les tailles/couleurs d’un même produit continuent à se cumuler. Le palier atteint s’applique proportionnellement aux quantités suivantes, avec un total arrondi au centime.

Compatibilité des anciens paliers unitaires conservée dans le champ JSON existant. Les totaux indivisibles en prix unitaires au centime sont répartis entre unités (3 pour 500 : 2 × 166,67 + 1 × 166,66), sans différence de total commande/CRM/COD. Prix moyen indiqué approximatif côté client si nécessaire ; total exact conservé. Idempotence, réservations, annulations et file CRM existantes inchangées. 88 tests de fonctionnement locaux réussis, build et lint réussis ; CI et publication à observer dans la PR. Aucun tarif réel, stock, message ou colis modifié pendant la recette.

## Promotions par quantité — candidat du 23 octobre 2026

Chaque fiche produit peut définir jusqu’à cinq paliers de quantité minimum et prix unitaire en MAD. Les variantes du même produit se cumulent ; les autres produits ne déclenchent pas sa remise. Le meilleur palier atteint s’applique à toutes les unités du produit, sans cumul avec le prix initial barré. Suppression des paliers = retour au prix courant. Aucune offre ni prix de production n’est activé par la livraison du code.

Calcul partagé panier/checkout et recalcul serveur à partir du catalogue dans la transaction de réservation. Seuil de livraison évalué après remise ; livraison offerte par produit conservée. Prix unitaire réduit figé dans la commande et sa capture CRM ; répétition idempotente conserve ce prix malgré une modification ultérieure du catalogue. Les anciens produits sans champ fonctionnent au prix normal. Champ JSON optionnel, génération Prisma uniquement, sans db push, migration ni réécriture du catalogue.

85 tests de fonctionnement locaux réussis ; compilation backend/web et lint réussis. Aperçu fictif contrôlé à 390/1440 px : deux couleurs à 200 MAD au lieu de 230, économie de 60 MAD, retour à 230 au retrait d’une unité. Quatre scénarios UI supplémentaires (client et administration sur deux largeurs) à vérifier en CI avant intégration. Aucun ordre, message ou colis réel créé.

## Cadres dorés des catégories — candidat du 23 octobre 2026

Les petites photos des catégories gardent leurs fichiers et leurs dimensions : anneau doré sur l’accueil, cadre ivoire/doré dans le menu et les filtres du catalogue, bordure champagne sur la catégorie active. Le sélecteur d’image et la règle limitant la navigation aux catégories publiées ne changent pas. Aucun téléversement ni changement de données.

Lint et compilation web réussis. Aperçu isolé vérifié à 320, 390 et 1440 pixels : pas de débordement ni d’image cassée, photo d’accueil 76/96 px, icône de menu 42 px et miniature du catalogue 30 px. CI et déploiement à vérifier dans la PR avant clôture ; comparaison des cinq fichiers publics prévue après publication.

## Présentation des photos originales — candidat du 23 octobre 2026

Le marchand a demandé de conserver intégralement ses photos : aucune retouche générée, aucun remplacement ni téléversement ne doit être appliqué. `photo-presentation.css` harmonise seulement les cadres ivoire/dorés, l’affichage entier avec `object-fit: contain`, les espacements, les miniatures sélectionnées, l’agrandissement et les petites photos du panier. Aucun filtre CSS sur les couleurs ni zoom au survol susceptible de rogner le produit.

Lint et compilation web réussis. Contrôles manuels de la copie isolée avec les originaux à 390 et 1440 pixels : quatre miniatures, sélection et agrandissement fonctionnels, images complètes, aucune image cassée ni débordement horizontal observés. La CI et la publication restent à vérifier avant clôture. Aucun changement de données produit, de stock, de commande ou d’intégration CRM.

## Suite de l’audit UX et conversion — candidat du 23 octobre 2026

Les collections publiques présentent uniquement les catégories contenant des produits publiés avec image, avec leur nombre d’articles. Les catégories vides restent administrables. Catalogue mobile raccourci, cadrage des photos sans découpe, petit visuel superposé de l’accueil masqué sur mobile et grille centrée pour les petits catalogues. Aucune photo produit, mesure, donnée de stock ou condition commerciale inventée.

Le checkout permet une recherche arabe/français dans les villes existantes tout en gardant le select natif et les identifiants canoniques du transporteur. Le résumé CRM affiche les derniers envois/retours réellement enregistrés, les attentes et échecs ; les clés restent dans Avancé et l’interrupteur IA reste accessible. Enregistrer n’envoie rien.

Statistiques internes : un ajout au panier par visite, ouverture du checkout et état actuel des commandes attribuées. Séparation par installation, exclusion tests/admin/DNT/GPC, identifiants hachés et rétention existante conservés. Les transitions enrichissent uniquement les événements déjà attribués, après transaction métier ; une erreur statistique ne doit jamais invalider une commande confirmée. Aucun nouvel événement Meta ni reprise historique. Une FAQ factuelle est disponible sur Contact.

Recette locale : 80 tests de fonctionnement réussis, compilations backend/web et lint réussis ; aperçu manuel à 390 et 1440 pixels. Catalogue mobile mesuré à 464 px du haut contre 650 px avant, sans débordement. Les essais automatisés UI doivent réussir en CI avant fusion : le navigateur autonome ne démarre pas dans l’environnement local. Les nouvelles photos réelles, conditions commerciales exactes et mesures de performance sur un téléphone/réseau limité restent à compléter. Publication à vérifier après fusion, sans commande réelle ni action transporteur.

## Audit prioritaire — candidat du 23 octobre 2026

Le panier est réhydraté après le premier rendu React. La cause de l’erreur 418 a été reproduite en développement : le compteur du CartDrawer affichait 0 côté serveur et 1 côté navigateur avec une ancienne session. Le correctif conserve le panier après rechargement sans masquer les avertissements React.

Les listes de pointures saisies comme une seule taille sont exclues des réponses publiques, des sélections et des nouvelles réservations serveur. L’administration conserve les variantes, leur stock et leur historique, avec un avertissement. Le générateur accepte les pointures séparées par des espaces et crée chaque nouveau stock à zéro. Aucun stock existant n’est réparti automatiquement. Les fiches affichent couleurs, tailles, aide au choix, description en paragraphes et frais issus des réglages Commerce ; description de secours cohérente dans la page, Open Graph, Twitter et JSON-LD.

Livraison et retours : présentation structurée et procédure de contact, frais actuels lus depuis les réglages. Les délais, frais et modalités de retour non fournis par le marchand restent explicitement non renseignés ; aucune politique commerciale inventée. Les textes validés restent prioritaires. Compléter et vérifier ces informations dans « Accueil et informations du magasin » avant leur publication.

Validation locale : 77 tests réussis sur une base MongoDB éphémère isolée, compilation web et backend, lint web. Recette de rendu et de panier dans Chrome ; nouveaux scénarios UI sur 390 et 1440 px à exécuter en CI avant fusion. Aucun ordre réel, message WhatsApp ni opération transporteur déclenché. Publication à observer après fusion ; ne pas déduire un déploiement réussi de ce document.

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

## Reusable company store foundation — 2026-10-19

See `COMPANY_STORE_TEMPLATE_2026-10-19.md`. New profiles use one deployment/database/storage/secrets per company, with an immutable database identity, encrypted admin-configurable confirmation mapping, a fresh-profile generator and first-admin provisioning. Existing installations retain their legacy connection. 36 isolated tests plus three hosted-runtime tests pass; local UI saving is verified. CRM enterprise/source/rule provisioning remains manual.

## Signed CRM confirmation receiver — 2026-10-19

See `CRM_CONFIRMATION_CALLBACK_2026-10-19.md`. Candidate receiver and transactional deduplication pass 31 isolated tests, build and lint. Feature is disabled until dedicated credentials and verified CRM mapping are activated; no production status synchronization is yet claimed.

## Administrator-managed CRM orders — 2026-10-19

See `ADMIN_MANAGED_CRM_2026-10-19.md`. The owner has replaced client choice with the saved administrator integration setting. Checkout no longer shows or sends a CRM option. New orders are queued atomically only when the integration is enabled/configured; disabled cycles leave pending jobs/attempts unchanged. Historical entries are not reconstructed and the cutoff remains unchanged. This supersedes earlier descriptions of optional customer CRM consent; privacy information remains on the privacy page.

## Hosted CRM diagnostic and opt-in scheduler — 2026-10-19

See `HOSTED_CRM_DELIVERY_2026-10-19.md`. Admin diagnostics distinguish missing events from pending/sent/failed jobs and show actual hosted scheduler registration. The combined launcher supports a separately gated scheduler, inactive by default without the new hosted opt-in. Isolated tests/build pass. Deployment does not authorize replay or activate delivery; operational verification is recorded separately.

## Mobile product detail — 2026-10-19

See `PRODUCT_DETAILS_2026-10-19.md`. Gallery/zoom controls, separate stock-aware colour/size choices and compact mobile identity improve presentation without changing catalogue data. Build/lint, read-only local variant fixtures, five-size and temporary local cart checks pass. Production validation is recorded separately; no order or CRM action.

## Header and mobile menu — 2026-10-19

See `HEADER_MENU_2026-10-19.md`. Search remains available on phones; the native menu adds search, catalogue categories and practical links, with focus/scroll management and responsive presentation. Build/lint and portrait/landscape navigation checks pass; publication evidence is recorded separately. No commerce or CRM writes.

## Professional footer — 2026-10-19

See `FOOTER_2026-10-19.md`. Responsive shopping/help navigation, a support card and dedicated social links preserve all original destinations. Frontend build/lint and four viewport checks pass. No commerce data or CRM change.

## Mobile cart and checkout — 2026-10-19

See `CART_CHECKOUT_2026-10-19.md`. Shared product lines/totals, a clearer drawer, compact phone order review, grouped address fields and a mobile confirmation bar continue the storefront design. Cart continuation requires verified products and available shipping fees, with recovery controls. The submit handler, COD payload, consent default and retry key are preserved. Candidate build/lint and locally intercepted failure/retry/success checks pass; no order POST is forwarded to production. Responsive and deployed checks are recorded separately.

## Professional responsive storefront — 2026-10-19

See `RESPONSIVE_STOREFRONT_2026-10-19.md`. A real catalogue image replaces the missing legacy hero default; the storefront adds a refined editorial layout, two-column phone catalogue, compact search/filter disclosure, category rail, mobile navigation, uncropped gallery/zoom, quantity controls and mobile purchase bar. Existing social destinations remain. Candidate production build/lint and browser checks at 320/390/768/1280 px pass, including zoom focus restoration, filtered search and temporary local cart interactions. No checkout, inventory or CRM write is part of this change; publication checks are recorded separately.

## Hosted demonstration photographs — 2026-10-19

The owner's follow-up identified missing social links after the earlier footer redesign. The original WhatsApp, Instagram, Facebook and TikTok destinations have been restored from Git history with keyboard-focus treatment and touch-sized links. No social message is sent by this change.

The owner authorized five generated product visuals on quickydev.com. The authenticated product editor replaced only the previous placeholder image lists; public before/after comparisons show prices, stock, variants, status, categories and product identities unchanged. See `catalogue/demo-images/README.md` for provenance, mapping and rollback. Five optimized WebP assets total 370,882 bytes. Build asset copying restores them into the API upload directory even when no standalone output exists, so their current content-addressed URLs survive fresh combined-hosting releases. This does not provide persistence for future arbitrary uploads and does not seed or modify the database. No checkout or CRM delivery is part of this image update.

## Hostinger runtime repair — 2026-10-19

See `HOSTINGER_RUNTIME_2026-10-19.md`. The root build now includes Prisma generation and backend compilation. An explicit combined hosting mode serves Express and Next through one public listener, with shared public read services for server rendering and a single host-managed listener. Local standalone mode is retained. The hosted entrypoint does not start background CRM/Sheets workers, seed products or change accounts; existing database and credentials remain authoritative. Production validation is recorded separately after deployment.

## Priority fixes implemented and locally verified

See [PRIORITY_FIXES_2026-10-18.md](PRIORITY_FIXES_2026-10-18.md) for the ten P1 corrections, operating instructions and remaining limits.

- Next 16.4.2, React 19.3.1 and Tailwind 4.3.3: backend compilation, frontend lint, type checks and production build pass. Fresh candidate dependency installation was used; npm audit reports zero vulnerabilities at verification time.
- Twelve isolated integration scenarios pass, including concurrent checkout, one local CRM event per order, stable retry keys, competing stock reservations and repeated cancellation. A local CRM simulator receives delivery tests.
- Browser verification in the isolated production build: administrator login, product name/stock update, storefront and successful checkout. Confirmation now scrolls into view. Narrow viewport measured 386 CSS pixels without horizontal overflow.
- Tested source and independently copied dependencies applied to the active local application after backup. Frontend and backend restarted; port 3000 storefront and API proxy verified. The existing pre-migration frontend supervisor needs the local development flag supplied through `.env.development.local`; a fresh `npm run dev` sets this automatically. No private environment file is tracked.
- Eleven known test/demo product records preserved as DRAFT after backing up their previous values. No ready commercial products remain in the storefront; actual product information and photographs must be supplied before sales.
- Active local order count, all eight CRM outbox states/attempt counts and manually maintained order indexes unchanged after application. Historical outbox cutoff preserved.
- CI verifies compilation, lint, build, isolated integration tests and dependency advisories on pull requests and updates of Master.

## Previous integration proof

PR #2 synchronized the local storefront and CRM integration; PR #3 recorded the audit. An earlier separately authorized synthetic checkout was observed as one local order, one SENT outbox row, one CRM receipt and one pipeline lead. No new order was sent to the real CRM for this correction batch.

## Remaining limits

- Telegram requires matching webhook-secret configuration and verified contact sharing before receiving customer notifications. Unverified old associations are ignored.
- Card-payment endpoints are closed; COD remains available. Stripe must be redesigned and tested before reactivation.
- Historical orders without a verified reservation require stock reconciliation before cancellation. No historical stock adjustment was guessed.
- The eleven P2 audit findings are implemented; see USABILITY_PERFORMANCE_2026-10-18.md for scope, verification, local measurements and owner content still required. No production field-performance certification is claimed.
- Preserve the historical CRM cutoff and manually managed database indexes. Never replay historical jobs as part of tests.

## Usability and performance follow-up

Twenty isolated scenarios pass. Public pages render their useful data on the server; product metadata, real 404s, robots and sitemap are implemented. Cart reconciliation, recovery after network failure, accessible dialogs, server-backed content publication and session renewal were verified in browsers. The public catalog remains empty until real products are supplied. Commercial terms require owner validation; generic pages do not invent delivery times or return rules.

Applied follow-up: the active port 3000 frontend and port 4000 backend have been restarted and verified. Live order count, all eight outbox rows (including attempts), product statuses and manually maintained order indexes match the pre-application snapshot. No site content was published on the active database.

## Explicitly authorized local test catalogue

The owner clarified that new catalogue entries are for testing, not real merchandise. Three labelled synthetic products with built-in imagegen WebP images and five variants were installed on local port 3000. See `catalogue/local-test/README.md` for fictional prices, provenance, strict opt-in installation and archive rollback. One browser checkout was verified, cancelled and its reserved stock restored; no new CRM event and no change to the eight previous outbox records. Real commercial product information remains outstanding.

## Storefront UI/UX redesign

See `STOREFRONT_DESIGN_2026-10-18.md`. The storefront uses a consistent ivory/forest palette, editorial home layout, category tiles, redesigned product cards, navigation and footer. Self-hosted Tajawal improves Arabic body text while Amiri headings and a Cormorant wordmark provide contrast. Product/checkout presentation and filter disclosure were refined. Backend and CRM logic are unchanged.

## Administration design and usability

See `ADMIN_WORKSPACE_2026-10-18.md`. A scoped ivory/forest admin workspace replaces the dark mixed-language tabs. Navigation, product/order search, editor feedback, session/sync states and mobile controls are clearer. Financial cards no longer invent a profit margin; their loaded-data scope is explicit. Frontend order actions follow existing backend transitions. Twenty-two isolated tests pass. After the owner stopped the old frontend, the tested production build was started on port 3000. Live authenticated browser checks verified dashboard rendering, product/order search and opening/cancelling the product editor. Order count, all CRM outbox states/attempts, product prices/statuses and variant stock match the pre-application snapshot. No backend, database schema or CRM configuration changes are part of this lot.

## Order tracking and detail follow-up

See `ORDER_WORKSPACE_2026-10-18.md`. Orders now have status counters, date/payment filters, sorting and an accessible detail dialog with delivery, recorded line prices, totals, notes and current progress. Every status change requires confirmation; uncertain writes/failed post-write refreshes require a successful manual refresh before further actions. Twenty-four isolated tests pass. Isolated browser checks cover lifecycle, cancellation/stock restoration, mobile layout and post-write read failure recovery. Port 3000 was restarted and its authenticated search/detail flow verified read-only. Live order statuses/payments/totals, outbox states/attempts, prices and stocks match the baseline. Loaded selection remains limited to the latest 100 orders; no historical transition dates or real-time carrier tracking are claimed.

## Product, photo and inventory follow-up

See `PRODUCT_STOCK_WORKSPACE_2026-10-18.md`. The product editor groups identity, photos and variants, with multi-file uploads/progress, cover/order controls, size generation, safe duplication, loaded-stock deltas and dirty-form protection. Stock filters distinguish partial low stock, complete stockouts and missing variants. Successful writes are distinguished from failed catalogue refreshes; uncertain saves require verification. Existing backend stock concurrency and publication rules remain authoritative. Twenty-eight isolated tests pass; browser checks verify two uploads, persisted cover order, three generated variants, duplicate SKU rejection, retained inputs and concurrent stock conflict/reload recovery. Desktop/mobile layouts and read-only active port 3000 search/editor checks pass. No live catalogue, inventory, order or CRM mutation is part of this phase.

## Accord WhatsApp à la soumission — candidat 20 octobre 2026

Voir WHATSAPP_CONSENT_SNAPSHOT_2026-10-20.md : capture exacte de la case avant attente, contrôles serveur et reçu client, sans consentement précoché ni reprise historique. Tests ciblés, lint frontend et compilation backend locaux réussis ; recette complète et publication encore à vérifier.

## 2026-10-22 — Olivraison automation (pending review)

A dependent branch adds opt-in automatic parcel creation, confirmation, pickup/PDFs and status polling after order confirmation. It depends on PR #48; no production deployment or real carrier call. See OLIVRAISON_AUTOMATION.md for activation, exception handling and tests. Default OFF; encrypted partner keys, no historical replay, shared rate gate and per-order lease/checkpoints.

## Société de livraison unique — 22 octobre 2026

Le formulaire Olivraison est masqué après sauvegarde et au rechargement lorsqu’une configuration existe, même désactivée ou sans clés. Le récapitulatif propose Modifier et Supprimer avec confirmation. Modifier recharge les valeurs enregistrées sans exposer les secrets ; Annuler abandonne les changements. DELETE administrateur efface le document et les clés, conserve les commandes/colis et refuse les colis non terminés. Une écriture transactionnelle partagée avec la mise en file évite la suppression concurrente à une nouvelle expédition. Aucun appel transporteur ni suppression de données de production pendant les tests.

Compilation backend/frontend et lint réussis. Tests UI 390/1280 px et intégration ajoutés ; résultats finaux dans le rapport de cette intervention.

## Aperçus produits — 22 octobre 2026

Diagnostic public : og:image et twitter:image pointaient vers http://localhost:3000/uploads alors que les photos étaient servies sur le domaine public. Les métadonnées utilisent maintenant SITE_URL ou le Host public de la requête (HTTPS hors boucle locale), avec nom, description, URL canonique et image absolue explicites pour Open Graph/Twitter. Même source produit serveur pour les fiches actuelles et futures. Aucun logo générique ajouté à une fiche sans photo. Tests ciblés origine multi-installation et cartes par produit ; caches externes à rafraîchir après publication.

## Retrait Olivraison avec colis en cours — 22 octobre 2026

Le propriétaire autorise le retrait des clés et l’arrêt du suivi automatique des deux colis existants, sans annulation chez le transporteur. DELETE conserve les références et documents, place les colis non terminés en DISCONNECTED et empêche leur reprise après reconnexion. Un échange déjà en cours (bail actif) impose seulement d’attendre sa fin. Historique affiché Suivi retiré sans bouton de reprise ; les colis retirés ne bloquent plus un changement ultérieur de compte. Tests : rejet pendant un échange, retrait idempotent, conservation commandes/références, reconnexion sans appel ni reprise historique.

## Saisie guidée des villes transporteur — 22 octobre 2026

Le champ texte ville=ville est remplacé par des lignes Ville sur la boutique / Ville chez Olivraison, avec ajout/retrait et suggestions natives après chargement de la liste Olivraison. Correspondances facultatives, valeurs existantes préservées, contrôle des lignes incomplètes et sources en double ; le format cityMapping et la résolution serveur restent inchangés. Aucun compte transporteur ni appel réel pendant la recette.
