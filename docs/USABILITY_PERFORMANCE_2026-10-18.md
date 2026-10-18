# Ergonomie et performance — 18 octobre 2026

Cette livraison traite les onze constats P2 de l’audit initial. Les règles de sécurité et les réservations de stock du lot P1 sont conservées.

| Constat | Mise à jour |
|---|---|
| A10 | Quantités plafonnées au stock, rafraîchissement des prix/disponibilités avant confirmation, avertissement et seconde validation si un prix change ; total attendu contrôlé dans la transaction serveur. |
| A11 | Configuration serveur avec brouillon privé, aperçu, publication volontaire, révision contre les conflits et restauration de la version publique précédente. Les bannières utilisent le stockage d’images authentifié. |
| A12 | Catalogue rendu serveur, recherche AR/FR/EN, catégorie, prix, disponibilité, tri et pagination ; état conservé dans l’URL. Les filtres avancés sont repliables sur mobile. |
| A13 | Réglages partagés avec reprises automatiques et bouton Réessayer ; panier et champs conservés après panne ; erreurs par champ et page d’erreur récupérable. |
| A14 | Dialogues natifs avec focus initial, confinement explicite, Échap et retour au bouton d’origine ; lien d’évitement, un seul repère main, aucun carrousel automatique, mouvement réduit pris en compte. |
| A15 | Accueil plus court sur mobile, message de paiement fixe, contrôles d’au moins 44 pixels, textes importants lisibles ; vérification aux quatre largeurs prévues. |
| A16 | Métadonnées par produit, canonique, données structurées, vraies réponses 404, sitemap des pages publiées et robots ; administration, authentification et commande hors index. |
| A17 | Rendu serveur, polices locales préchargées sans bascule tardive, réglages mutualisés, onglets/graphiques administrateur chargés à la demande et préchargements de fiches limités ; mesures et budgets ci-dessous. |
| A18 | Témoignages non vérifiés retirés. Pages livraison, retours et confidentialité reliées avant commande ; textes par défaut limités au fonctionnement réel du site. Champs commerciaux à compléter et faire valider avant publication. |
| A19 | Renouvellement de jeton avec rotation, protection contre le rejeu et partage de la reprise entre requêtes/onglets ; déconnexion serveur ; session expirée et synchronisation en échec clairement affichées. Polling espacé, suspendu en arrière-plan et sans requêtes superposées. |
| A20 | Aucun jeu de démonstration au démarrage, même avec l’ancien drapeau. Commande explicite et garde serveur réservées à une base locale isolée de test. |

## Mesures reproductibles de production

Comparaison sur la même machine et un catalogue isolé contenant un produit. Les octets correspondent aux scripts référencés dans le HTML, recompressés avec gzip ; ils ne représentent pas le transfert total de la page. Les onglets administrateur après authentification restent chargés lorsqu’ils sont utilisés.

| Page | Scripts gzip avant (octets) | Après | Réduction |
|---|---:|---:|---:|
| `/` | 273119 | 219633 | 19.6 % |
| `/shop` | 266432 | 219633 | 17.6 % |
| `/products/preview-bag` | 265386 | 223339 | 15.8 % |
| `/admin` | 398306 | 227830 | 42.8 % |

Budgets du script : 250 Kio par page publique mesurée et 280 Kio pour la connexion administrateur. Les quatre pages respectent ces budgets. Exécuter `node scripts/measure-production.cjs http://127.0.0.1:3102` sur une prévisualisation de production déjà démarrée ; le script échoue si un budget est dépassé. Les temps HTTP sont des médianes de cinq requêtes chaudes et ne sont pas des Core Web Vitals. Le nouveau rendu inclut les données serveur, contrairement à l’ancien HTML en attente d’hydratation : sa durée serveur n’est donc pas comparable comme une même charge de travail.

La page `/?measure=1`, chargée directement, active une mesure locale dans la console. Elle charge `web-vitals` uniquement pour ce diagnostic, sans envoyer les mesures à un service externe. Méthode : une navigation locale sans limitation artificielle par taille, puis ouverture/fermeture du panier. Source de la méthode : [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals).

| Largeur CSS | LCP | INP observé | CLS |
|---|---:|---:|---:|
| 390 px | 364 ms | 88 ms | 0.0000 |
| 1440 px | 212 ms | 56 ms | 0.0000 |

Ce sont des échantillons de laboratoire local, pas des mesures terrain ni un score Lighthouse. Aucun résultat avant modification n’est disponible pour ces trois métriques ; aucune amélioration chiffrée des Core Web Vitals par rapport à l’ancienne version n’est revendiquée. Objectifs de suivi : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Les données terrain et les conditions réseau réelles restent à observer après une éventuelle mise en ligne.

## Vérifications

- 20 scénarios automatisés : les 12 du lot P1, plus panier, publication/conflits/retour arrière, validation des textes et liens, recherche/pagination, changements de total, rotation/déconnexion et séparation des démonstrations.
- Compilation backend, lint sans avertissement, types et production frontend vérifiés ; analyse npm sans vulnérabilité signalée.
- Navigateur : plafond de quantité ; panne de frais de livraison récupérée sans ressaisie ; changement de prix présenté avant création d’une seule commande isolée ; page 2 et retour depuis une fiche ; brouillon, publication et retour arrière entre Chrome et le navigateur intégré ; reprise de session simulée.
- Clavier : focus initial, Maj+Tab confiné, Échap et retour du focus. Un seul main et aucune largeur débordante mesurés à 360, 390, 768 et 1440 pixels CSS.
- HTTP : titres et données produit présents dans le HTML, produit absent en 404, sitemap/robots et trois pages pratiques en 200.

## Exploitation et contenu à compléter

Le catalogue réel reste à renseigner : les onze anciennes démonstrations demeurent en brouillon. Les informations commerciales précises (identité/adresse, délais, conditions de retour) restent à fournir par le propriétaire ; aucun délai, aucune adresse et aucune règle de retour n’ont été inventés. Les textes génériques orientent vers le contact et les frais réellement configurés.

La nouvelle collection MongoDB `site_content` est créée seulement à la première sauvegarde de configuration. Ne pas exécuter prisma db push. Les lectures publiques ne créent pas de configuration. Pour un démarrage compilé, construire d’abord le paquet partagé : `npm --prefix packages/shared run build`, puis le backend. `npm run check` applique déjà cet ordre.

Renseigner `SITE_URL` sur le domaine final avant une mise en ligne pour les canoniques et le sitemap ; le défaut localhost correspond au site demandé ici. Conserver le seuil historique du worker CRM et les index existants. Aucun événement historique ne doit être rejoué pour tester cette livraison.
