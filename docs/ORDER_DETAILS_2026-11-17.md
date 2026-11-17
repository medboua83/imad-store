# Détails des commandes — candidat du 17 novembre 2026

Demande : transmettre les tailles/couleurs à Olivraison, rendre les frais explicites avant confirmation, afficher les produits et leurs photos dans les commandes administrateur.

## Transporteur : préparé, non déployé

Le worker charge maintenant la variante de chaque ligne. La description contient quantité, nom du produit, taille, couleur, SKU et prix unitaire enregistré lorsque ces données existent. Le montant COD enregistré, l'identité stable du colis, les conditions d'éligibilité et le cutoff historique restent inchangés. Une description vide ou supérieure à la limite existante de 1000 caractères est mise en attention via le traitement d'erreur existant ; aucune ligne n'est silencieusement coupée.

Sept tests unitaires Olivraison réussis, compilation backend réussie. Aucun appel réel de création de colis ni commande réelle pendant cette validation. Pas de migration.

Limite existante : les lignes de commande référencent le catalogue et ses variantes ; elles ne disposent pas encore d'un instantané historique des libellés. Cette modification ne prétend pas reconstruire une ancienne taille/couleur modifiée dans le catalogue.

## Interfaces : en préparation

Capture du checkout mobile : la livraison de 40 MAD est dans le résumé repliable pour un exemple de produits à 200 MAD, total 240 MAD. Préparer les directions Product Design, puis implémenter la direction choisie. Le dashboard réel demande une connexion ; ne pas affirmer avoir contrôlé ses commandes authentifiées avant cet accès. Les images devront suivre les associations photo-couleur existantes et avoir un état d'échec explicite.

## Intégration précédente

PR142 fusionnée dans Master au commit 0fecf9f8fe6f329aaa9eb86c9680a747bd790e61. Les 337 tests UI, 135 tests serveur et compilations passent. Le contrôle npm audit reste rouge pour des dépendances préexistantes, sans modification du verrou de dépendances par cette PR. Ne pas présenter la CI comme entièrement verte.
