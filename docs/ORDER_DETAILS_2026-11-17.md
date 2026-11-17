# Détails des commandes — candidat du 17 novembre 2026

Demande : transmettre les tailles/couleurs à Olivraison, rendre les frais explicites avant confirmation, afficher les produits et leurs photos dans les commandes administrateur.

## Transporteur : préparé, non déployé

Le worker charge maintenant la variante de chaque ligne. La description contient quantité, nom du produit, taille, couleur, SKU et prix unitaire enregistré lorsque ces données existent. Le montant COD enregistré, l'identité stable du colis, les conditions d'éligibilité et le cutoff historique restent inchangés. Une description vide ou supérieure à la limite existante de 1000 caractères est mise en attention via le traitement d'erreur existant ; aucune ligne n'est silencieusement coupée.

Sept tests unitaires Olivraison réussis, compilation backend réussie. Aucun appel réel de création de colis ni commande réelle pendant cette validation. Pas de migration.

Limite existante : les lignes de commande référencent le catalogue et ses variantes ; elles ne disposent pas encore d'un instantané historique des libellés. Cette modification ne prétend pas reconstruire une ancienne taille/couleur modifiée dans le catalogue.

## Interfaces : candidat préparé

Direction Product Design 3 choisie par l'utilisateur : étape finale dédiée, produits et variantes, adresse modifiable, détail des frais et total, confirmation explicite. Le premier envoi du formulaire valide et rafraîchit le panier/réglage, puis ouvre la révision sans créer de commande. Le second conserve le mode de confirmation marchand et les protections serveur du montant/idempotence. Les frais restent visibles dans la barre mobile, y compris avant la révision. Les valeurs proviennent des réglages, sans tarif inventé.

Dashboard réel authentifié inspecté en lecture seule : taille/couleur déjà affichées mais photo absente. Le candidat ajoute la photo associée à la couleur, le SKU et des libellés explicites ; images générales en repli seulement lorsqu'aucune association n'existe. Une photo associée défaillante ne bascule pas sur une autre couleur. Aucun changement de commande réelle.

Validation ciblée : 54 tests navigateur à 320/390/1440 px, compilation et types réussis. Les tests de soumission existants suivent maintenant les deux actions distinctes réviser/confirmer ; les assertions de contenu, prix, absence de double écriture et conservation des informations sont conservées. Trois tests supplémentaires vérifient la photo chargée de la variante, le SKU, la taille/couleur et les montants admin sans écriture. QA visuelle et CI complète à consigner avant publication.

## Intégration précédente

PR142 fusionnée dans Master au commit 0fecf9f8fe6f329aaa9eb86c9680a747bd790e61. Les 337 tests UI, 135 tests serveur et compilations passent. Le contrôle npm audit reste rouge pour des dépendances préexistantes, sans modification du verrou de dépendances par cette PR. Ne pas présenter la CI comme entièrement verte.
