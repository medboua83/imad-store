# Publication du 6 novembre 2026 — administration arabe et favicon

La boutique `https://imadmode.com` sert les changements des PR 93 et 94 : interface d’administration français/arabe, lecture RTL, préférence mémorisée, prix sur les raccourcis de quantité, rappel de la variante près de l’achat et favicon IM dorée.

## Version et retour arrière

- Code effectivement déployé : `c2e3cc6aa05b9be96c91aba7ad1203a3b4e389dd`.
- Arbre identique au Master de fusion `257e97a77aa91d848f74e37f96b679df2d8a9af9`.
- Version active : `/srv/imadmode/releases/admin-arabic-c2e3cc6aa05b`.
- Version antérieure conservée : `/srv/imadmode/releases/domain-imadmode-20261106`.
- Le déploiement utilise un pointeur atomique et prévoit un retour automatique à la version antérieure si les contrôles de disponibilité échouent. Aucun retour arrière n’a été nécessaire.
- Les mises à jour ultérieures de documentation ne constituent pas une nouvelle publication du code applicatif.

## Contrôles

La CI 42256286796 est réussie : compilation, lint, 148 scénarios UI, 106 tests PostgreSQL/unitaires, installation, boutique et serveur combiné. La compilation réalisée sur le VPS réutilise les dépendances Linux existantes, notamment le traitement natif des images adapté au processeur. Aucun module macOS n’est transféré.

Les liens d’icônes sont présents sur l’accueil, le catalogue, la connexion admin et une fiche produit publique. Les réponses ICO, SVG et Apple PNG renvoient HTTP 200 avec les empreintes attendues. La connexion à l’administration, la bascule français/arabe, le maintien de la session et la mémorisation de l’arabe après rechargement sont vérifiés. Les deux images des fiches du catalogue admin se chargent. Les vues à 390 et 1440 px ne débordent pas horizontalement. La sélection de deux puis trois pièces met à jour le total de la fiche selon les prix du catalogue ; aucun article n’est commandé.

## Conservation des données et de l’accès

Une sauvegarde des données, images et environnements a été créée avant changement, contrôlée sur le VPS puis copiée dans le stockage privé DATA avec vérification des quatre empreintes. Les empreintes des produits, variantes, commandes, catégories, réglages, contenus, identité d’installation et connexions CRM/transporteur ainsi que celles des environnements et des originaux des photos sont identiques avant et après publication.

Aucune migration, modification des stocks, réactivation d’intégration ou commande de test n’a lieu pendant cette publication. Les anciens fichiers et la version de retour restent conservés.

L’accès SSH est limité à l’IP autorisée et à deux heures, avec minuterie de retrait observée active. Après expiration, une nouvelle connexion est refusée et la clé privée locale dédiée est supprimée. Le retrait manuel préparé n’a pas été exécuté, car l’accès avait déjà expiré ; le contenu du fichier des clés serveur n’a pas été relu après expiration. Aucun autre accès n’est modifié.

Les captures, empreintes, résultats de publication et justificatifs de contrôle restent sur DATA dans les dossiers d’intervention ; aucun secret, sauvegarde ou renseignement client n’est ajouté au dépôt.
