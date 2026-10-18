# Audit Imad Store — stabilité, performance et facilité d’utilisation

Date : 18 octobre 2026.

Le parcours de base fonctionne, et l’essai précédemment autorisé a confirmé une création unique et une réception unique dans le CRM. Le site ne doit cependant pas être considéré comme prêt à une ouverture commerciale sans traiter les priorités P1 ci-dessous. Cet audit documente des constats ; il ne corrige pas le code applicatif et ne certifie pas la sécurité globale.

## Périmètre et méthode

Navigation sur le site local, lecture du code frontend/backend, requêtes HTTP en lecture, inspection du DOM et audit du fichier de verrouillage des dépendances. La vérification du suivi a utilisé uniquement la commande synthétique déjà créée, sans lire de commande d’un client réel. Aucun nouveau produit, paiement, commande ou envoi CRM n’a été créé pendant cet audit. L’article placé temporairement dans le panier pour tester le clavier a été retiré.

Les références de code sont relatives au dépôt synchronisé. Les constats sont distingués entre observations navigateur/HTTP et lecture de code. Les modifications métier, les migrations et les tests de défaillance restent à effectuer dans un environnement isolé.

## État observé

- Catalogue public : 11 produits, 10 sans image, 10 sans variante, un seul achetable ; tous classés dans bags.
- Accueil : les six premiers produits affichés ne sont pas les produits achetables.
- Livraison : 30 MAD et gratuite dès 500 MAD ; le panier et la commande affichent les mêmes totaux lors des essais précédents.
- Intégration CRM : une réception et un prospect constatés pour l’essai autorisé, sans doublon observé sur ce cas. Les scénarios de répétition et de panne ne sont pas certifiés.
- Affichage : contrôle ordinateur et étroit. La largeur CSS réellement retournée au contrôle étroit était 484 px malgré une largeur demandée plus petite ; aucune validation à 390 px n’est revendiquée.
- Dépendances de production : 22 entrées signalées par npm audit, dont 2 critiques, 9 élevées et 11 modérées. Il s’agit de signalements du verrouillage, pas de preuves d’exploitation.
- Performance : pas de mesure Lighthouse ni de mesures terrain p75 pendant cet audit. Les temps d’un serveur de développement ne constituent pas une référence de production.

P1 = à traiter avant ouverture commerciale ou activation de la capacité concernée. P2 = amélioration importante de fiabilité, d’ergonomie ou d’exploitation.

## Constats priorisés

### A01 — P1 — Confidentialité du suivi de commande

Preuve : HTTP sur la commande synthétique existante + code.

Le suivi invité renvoie l’objet complet : coordonnées, adresse et champs techniques de déduplication. La connaissance de la référence ne doit pas donner accès au dossier client complet.

Correction proposée : Définir un suivi public minimal ; réserver les détails aux personnes autorisées, avec preuve de possession pour un suivi invité détaillé.

Critère de validation : Une lecture anonyme ne restitue aucune coordonnée ni clé technique ; un accès administratif valide conserve les détails utiles.

Référence : [backend/src/controllers/order.controller.ts:168](../backend/src/controllers/order.controller.ts#L168).

### A02 — P1 — Authentification des notifications Telegram

Preuve : Code ; aucun envoi réalisé pendant cet audit.

Le récepteur accepte les mises à jour et l’association téléphone/conversation sans vérifier leur provenance ni la possession du numéro.

Correction proposée : Authentifier les mises à jour du fournisseur et vérifier l’association d’un numéro avant de transmettre des confirmations privées.

Critère de validation : Les requêtes non authentifiées sont rejetées avant toute écriture ou émission ; un numéro ne peut pas être associé par simple déclaration.

Référence : [backend/src/routes/telegram.routes.ts:14](../backend/src/routes/telegram.routes.ts#L14).

### A03 — P1 — Paiement à sécuriser avant activation

Preuve : Code ; risque conditionnel à l’activation de Stripe.

L’interface affiche la carte comme désactivée, mais une route de création de paiement subsiste. Le montant vient de la requête, et le traitement de succès ne rapproche pas le montant payé du montant attendu. Aucun paiement n’a été tenté.

Correction proposée : Désactiver effectivement cette capacité tant qu’elle n’est pas utilisée ; pour son activation, calculer le montant sur commande côté serveur et vérifier devise, montant et identité du paiement reçu.

Critère de validation : Un montant imposé par le navigateur ne peut pas changer le prix ; un paiement insuffisant ne confirme pas une commande.

Référence : [backend/src/controllers/payment.controller.ts:14](../backend/src/controllers/payment.controller.ts#L14).

### A04 — P1 — Stocks et annulations incohérents

Preuve : Code ; aucune annulation réelle effectuée.

Le stock est réservé lors de la création. Le changement de statut vers annulation ne libère pas cette réservation ; le synchroniseur Sheets change également les statuts sans passer par une politique de stock commune.

Correction proposée : Centraliser les transitions autorisées et restituer une réservation annulée avant expédition, une seule fois et dans une transaction. Définir séparément les retours après livraison.

Critère de validation : Créer puis annuler une commande dans une base de test restitue exactement la quantité ; répéter l’annulation n’augmente pas davantage le stock.

Référence : [backend/src/controllers/order.controller.ts:189](../backend/src/controllers/order.controller.ts#L189).

### A05 — P1 — Administration des produits incomplète

Preuve : Code ; aucune création de produit pendant l’audit.

Le nom arabe est obligatoire dans le serveur mais absent du formulaire affiché. La création initialise une variante avec stock nul. Aucun éditeur utilisable de variantes/stock n’est proposé ; le serveur ignore les variantes lors d’une mise à jour.

Correction proposée : Afficher les champs réellement nécessaires, ajouter un éditeur couleurs/tailles/SKU/stock et enregistrer les variantes de manière transactionnelle. Donner un retour d’erreur visible par champ.

Critère de validation : Un administrateur peut créer un produit FR/AR/EN avec photo et stock positif, le vendre, puis modifier son stock sans intervention technique.

Référence : [apps/web/app/admin/tabs.tsx:339](../apps/web/app/admin/tabs.tsx#L339).

### A06 — P1 — Ajout des images non fonctionnel de bout en bout

Preuve : Code ; aucune image envoyée.

Le sélecteur de fichiers produit une Data URL, ensuite découpée sur les virgules comme une liste de liens. Les pages publiques n’acceptent pas ce format. Le stockage actuel ne constitue donc pas un téléversement exploitable.

Correction proposée : Mettre en place un stockage d’images durable avec contrôle type/taille, retourner une URL supportée et conserver les images sous forme de tableau.

Critère de validation : Une image choisie depuis un téléphone reste visible après enregistrement, rechargement et consultation depuis un autre navigateur.

Référence : [apps/web/app/admin/tabs.tsx:13](../apps/web/app/admin/tabs.tsx#L13).

### A07 — P1 — Catalogue non prêt à la vente

Preuve : API publique + navigateur.

11 produits actifs observés : 10 sans image, 10 sans variante, un seul avec stock achetable. Tous sont classés dans bags. La seule fiche achetable utilise une image de démonstration de fleurs. L’accueil sélectionne les six premiers produits et n’affiche donc pas cette fiche achetable.

Correction proposée : Revoir les fiches de démonstration avec le propriétaire, les passer en brouillon ou les compléter ; utiliser les vraies photos et catégories. Sélectionner des fiches prêtes à la vente pour l’accueil.

Critère de validation : Les produits mis en avant disposent d’une photo pertinente, d’une catégorie exacte et d’une variante achetable ; les données de test ne sont pas publiées involontairement.

Référence : [apps/web/app/page.tsx:537](../apps/web/app/page.tsx#L537).

### A08 — P1 — Validation des paramètres et messages serveur

Preuve : HTTP en lecture + code.

Un numéro de page non numérique produit une réponse 500 qui contient un diagnostic Prisma et un chemin local. Une limite nulle est acceptée. Les limites, statuts et identifiants ne sont pas validés uniformément.

Correction proposée : Valider et borner les entrées ; séparer le catalogue public actif du catalogue administratif ; retourner des erreurs métier lisibles et garder les diagnostics dans des journaux privés.

Critère de validation : Les entrées invalides donnent des 400 stables ; aucune réponse publique ne contient de chemin local ou de diagnostic ORM ; un visiteur ne consulte pas de brouillons.

Référence : [backend/src/controllers/product.controller.ts:33](../backend/src/controllers/product.controller.ts#L33).

### A09 — P1 — Maintenance des dépendances

Preuve : npm audit sur le fichier de verrouillage, dépendances de production.

Le registre signale 22 entrées de paquets vulnérables : 2 critiques, 9 élevées et 11 modérées. Ce nombre ne signifie pas 22 failles exploitables sur le site. Plusieurs avis Next dépendent de Windows ou de l’optimiseur d’images, désactivé ici ; l’avis proxy-addr dépend de la confiance accordée au proxy.

Correction proposée : Trier l’applicabilité par configuration, appliquer les correctifs compatibles et préparer une migration du framework sur une branche dédiée. Refaire compilation et tests de parcours après chaque lot. Éviter une mise à jour forcée globale.

Critère de validation : Chaque avis a une décision documentée ; les versions exposées sont corrigées ; les fonctions catalogue, administration et commande sont retestées.

Référence : [package-lock.json:1](../package-lock.json#L1).

### A10 — P2 — Panier : quantités et prix périmés

Preuve : Code.

Le panier persiste les prix et permet d’augmenter les quantités sans plafond de stock. Le serveur réserve déjà le stock de façon conditionnelle et recalcule les prix : le risque observé concerne surtout l’expérience de commande et les écarts de total.

Correction proposée : Plafonner les quantités, rafraîchir disponibilité et prix avant validation et signaler explicitement tout changement.

Critère de validation : Le panier ne propose pas plus que le stock courant ; un changement de prix est présenté avant la confirmation.

Référence : [apps/web/src/store/cart.store.ts:42](../apps/web/src/store/cart.store.ts#L42).

### A11 — P2 — Personnalisation du site non publiée

Preuve : Code.

Les bannières et réglages du constructeur d’accueil sont enregistrés dans localStorage. L’accueil public ne consomme pas ces réglages. L’enregistrement ne publie donc pas les modifications aux autres visiteurs.

Correction proposée : Persister une configuration serveur versionnée, avec aperçu, publication explicite et retour à la version précédente.

Critère de validation : Une modification publiée depuis un navigateur apparaît pour un visiteur dans un autre navigateur ; un brouillon reste privé.

Référence : [apps/web/app/admin/tabs.tsx:439](../apps/web/app/admin/tabs.tsx#L439).

### A12 — P2 — Recherche, filtres et pagination limités

Preuve : Navigateur + code.

La boutique charge au maximum 100 produits et filtre ce lot dans le navigateur. Il n’y a ni pagination visible ni tri, filtre prix ou filtre disponibilité. Les catégories se trouvent surtout dans la navigation générale.

Correction proposée : Ajouter une recherche serveur AR/FR/EN, des filtres proches de la grille, un tri et une pagination avec état dans l’URL.

Critère de validation : Un produit au-delà du premier lot reste accessible ; filtres et page sont conservés en revenant d’une fiche.

Référence : [apps/web/app/shop/page.tsx:26](../apps/web/app/shop/page.tsx#L26).

### A13 — P2 — Récupération après erreur réseau

Preuve : Code.

Un échec du chargement des réglages laisse les frais inconnus et le bouton de commande désactivé sans récupération automatique. Les messages de validation affichent d’abord une erreur générique plutôt que le champ concerné.

Correction proposée : Afficher des états chargement/erreur distincts, un bouton Réessayer et des erreurs par champ. Conserver le panier et les données déjà saisies.

Critère de validation : Après un échec réseau simulé, le client peut reprendre sans recharger ni ressaisir ; la raison du blocage est visible.

Référence : [apps/web/src/hooks/useShipping.ts:9](../apps/web/src/hooks/useShipping.ts#L9).

### A14 — P2 — Clavier et structure accessible

Preuve : Navigateur + DOM + code.

La touche Échap ne ferme pas le panier, le focus reste sur le bouton derrière le panneau, et aucun dialogue modal sémantique n’est déclaré. La boutique contient deux éléments main imbriqués. Les carrousels se déplacent sans commande de pause et le mouvement réduit n’est pas pris en compte.

Correction proposée : Gérer les panneaux comme des dialogues avec focus initial, confinement et restitution ; fermeture Échap ; un seul repère main ; pause et respect des préférences de mouvement.

Critère de validation : Le parcours panier complet est réalisable au clavier ; le focus reste visible ; un lecteur d’écran identifie correctement les régions et les panneaux.

Référence : [apps/web/src/components/layout/CartDrawer.tsx:58](../apps/web/src/components/layout/CartDrawer.tsx#L58).

### A15 — P2 — Lisibilité et simplicité mobile

Preuve : Navigateur étroit + code.

Plusieurs textes d’action et d’information sont en 9–11 px. Le grand bandeau d’accueil impose au moins 800 px de hauteur avant les produits, et le bandeau de livraison défile en continu. L’absence de débordement a été observée à 484 px CSS, sans certification de tous les appareils.

Correction proposée : Raccourcir l’introduction sur mobile, rendre les informations et actions essentielles plus lisibles, stabiliser le message de livraison et rapprocher les produits de l’entrée de page.

Critère de validation : Vérifier des largeurs CSS réelles de 360, 390, 768 et 1440 px ; les boutons et messages restent lisibles et les actions principales facilement atteignables.

Référence : [apps/web/app/page.tsx:78](../apps/web/app/page.tsx#L78).

### A16 — P2 — Référencement des fiches

Preuve : HTTP + code.

robots.txt et sitemap.xml répondent 404. Les titres et descriptions sont communs aux pages publiques. Les fiches sont chargées côté client, et un produit absent n’utilise pas une vraie réponse de page 404.

Correction proposée : Créer des métadonnées propres à chaque fiche, les URL canoniques, un sitemap, un robots adapté et un rendu serveur des informations utiles ; conserver les pages privées hors index.

Critère de validation : Une fiche possède son titre, sa description et ses données produit dans le HTML ; une fiche absente renvoie 404 ; le sitemap ne contient que les URL publiées.

Référence : [apps/web/app/layout.tsx:6](../apps/web/app/layout.tsx#L6).

### A17 — P2 — Performance : mesurer puis cibler les coûts

Preuve : Code + poids des fichiers ; aucun score de production établi.

Accueil/catalogue/fiches font leurs requêtes après hydratation, les polices passent par un import Google Fonts dans le CSS, les animations sont nombreuses et l’administration charge ses onglets et graphiques ensemble. Les quatre images locales font seulement environ 31–59 Kio : elles ne prouvent pas, seules, un problème de poids.

Correction proposée : Mesurer une compilation de production, pré-rendre le catalogue approprié, mutualiser les réglages, héberger les polices localement, charger les onglets lourds à la demande et définir une politique de cache séparant public et données privées.

Critère de validation : Fixer une référence de production reproductible, puis suivre LCP, INP et CLS sans régression sur mobile. Les objectifs sont des cibles, pas des mesures actuelles.

Référence : [apps/web/app/globals.css:1](../apps/web/app/globals.css#L1).

### A18 — P2 — Confiance et informations pratiques

Preuve : Navigateur + code.

La page contact existe, mais les informations de livraison, échange/retour et confidentialité ne sont pas structurées en pages dédiées. Les témoignages sont codés en dur et illustrés avec des images du catalogue ; leur provenance n’a pas été vérifiée.

Correction proposée : Faire valider les informations commerciales par le propriétaire, présenter clairement délais et frais, et n’afficher que des témoignages dont la provenance est établie.

Critère de validation : Le client trouve les conditions utiles avant de commander ; aucune promesse ou preuve sociale non vérifiée n’est ajoutée.

Référence : [apps/web/app/page.tsx:423](../apps/web/app/page.tsx#L423).

### A19 — P2 — Session administrateur et synchronisation

Preuve : Code.

Le jeton de renouvellement est enregistré, mais aucune logique de renouvellement côté interface n’est présente. Une session expirée peut laisser l’interface ouverte avec des données figées. Les requêtes en erreur sont souvent seulement journalisées.

Correction proposée : Gérer le renouvellement, les réponses 401/403 et la déconnexion serveur ; afficher l’état réel des chargements et synchronisations.

Critère de validation : Une expiration simulée entraîne un renouvellement valide ou une demande de reconnexion claire ; les données ne paraissent pas à jour lorsque la requête a échoué.

Référence : [apps/web/app/admin/page.tsx:51](../apps/web/app/admin/page.tsx#L51).

### A20 — P2 — Données de démonstration au démarrage

Preuve : Code.

Le démarrage serveur peut créer un produit de démonstration actif si le catalogue est vide. Ce comportement est indépendant de la publication volontaire des produits.

Correction proposée : Séparer l’initialisation technique et les jeux de démonstration ; réserver ces derniers à une commande explicite sur environnement de test.

Critère de validation : Démarrer une production vide ne publie aucune fiche fictive ; les jeux de test sont reproductibles dans une base isolée.

Référence : [backend/src/lib/seedAdmin.ts:18](../backend/src/lib/seedAdmin.ts#L18).

### A21 — P1 — Contrôles automatiques avant livraison

Preuve : Inventaire du dépôt et résultats GitHub disponibles.

Aucun fichier de tests ni workflow CI suivi dans le dépôt n’a été trouvé. La compilation passée et un test de commande réussi ne couvrent pas les annulations répétées, les pertes de réponse, la concurrence ou les pannes du CRM.

Correction proposée : Ajouter une chaîne de vérification avec base de test isolée et CRM simulé : types, compilation, tests métier et parcours critiques. Conserver les secrets et clients hors des tests.

Critère de validation : Une régression sur prix, stock, confidentialité ou déduplication bloque la fusion ; les tests ne peuvent pas contacter le CRM réel ni rejouer les anciens événements.

Référence : [package.json:1](../package.json#L1).

## Ordre de réalisation proposé

| Lot | Objectif | Résultat attendu |
| --- | --- | --- |
| 1 — Protéger et fiabiliser | A01–A04, A08, A09, A21 | Données privées protégées, entrées validées, stocks cohérents, dépendances triées, contrôles automatiques. |
| 2 — Rendre la boutique exploitable | A05–A07, A10–A13, A19–A20 | Fiches réelles avec images et variantes, administration complète, erreurs récupérables, panier cohérent et catalogue parcourable. |
| 3 — Simplifier les parcours | A14–A16, A18 | Navigation clavier et mobile, achat plus lisible, informations fiables et fiches indexables. |
| 4 — Mesurer et optimiser | A17 puis vérification des autres lots | Référence de performance reproductible, budget de JavaScript, cache public maîtrisé et suivi des régressions. |

## Critères de sortie pour une version plus avancée

1. Un administrateur gère réellement produits, photos, variantes, prix, stocks et publication depuis l’interface.
2. Le visiteur trouve un produit disponible, comprend les frais et peut reprendre après une erreur sans perdre sa saisie.
3. Le suivi invité ne divulgue pas le dossier client et les intégrations vérifient leur provenance.
4. Création répétée, annulation répétée, manque de stock et CRM indisponible sont testés dans une base isolée avec un destinataire simulé.
5. Un catalogue au-delà de 100 fiches reste parcourable ; les pages produit possèdent de vraies métadonnées et les absences renvoient 404.
6. La performance est mesurée sur la compilation de production. Cibles de référence : LCP au plus 2,5 s, INP au plus 200 ms, CLS au plus 0,1 au 75e percentile, séparément mobile/ordinateur. Ces seuils ne sont pas les résultats actuels du site. [Référence Google](https://web.dev/articles/vitals).
7. Les cibles tactiles et leur espacement sont examinés selon leur contexte et les exceptions applicables, sans revendiquer une conformité sur simple mesure de hauteur. [Référence W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Dépendances et références techniques

Les deux entrées classées critiques concernent notamment Next.js et proxy-addr. L’avis Next sur Windows ne démontre pas une vulnérabilité de ce poste macOS ; l’autre avis critique étudié concerne l’optimisation AVIF, alors que les images sont actuellement non optimisées. Il faut néanmoins trier les autres avis du paquet et préparer les versions corrigées. La confiance accordée aux proxys doit également être vérifiée dans l’hébergement réel.

- [Avis Next sur les serveurs Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36)
- [Avis Next sur l’optimisation AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)
- [Avis proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)
- [Polices dans Next.js 14](https://nextjs.org/docs/14/app/building-your-application/optimizing/fonts)

## Limites

L’administration authentifiée n’a pas été modifiée ni testée par création/édition pendant cet audit ; les défauts correspondants proviennent de la lecture des composants et contrôleurs. Aucun test d’intrusion, de charge, de paiement réel, de restauration complète de sauvegarde ou de délivrabilité externe n’a été réalisé. La conformité juridique, la provenance des témoignages et les droits sur les visuels n’ont pas été certifiés. Les captures, chemins locaux, données de test détaillées et rapports bruts restent hors du dépôt public.

## Suivi du lot prioritaire

Les dix constats P1 ont été traités dans une livraison distincte de l’audit initial. Voir [corrections, vérifications et limites opérationnelles](PRIORITY_FIXES_2026-10-18.md). Les observations ci-dessus décrivent l’état initial ; elles ne doivent pas être interprétées comme l’état actuel du site.
