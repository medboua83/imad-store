# Catalogue de test local — 18 octobre 2026

À la demande explicite du propriétaire, ces trois articles sont entièrement fictifs : images générées avec l'outil intégré imagegen, prix, variantes et stocks de test. Les noms et descriptions signalent cette nature en français, arabe et anglais. Aucun de ces visuels ne documente des marchandises réelles.

| Article | Prix fictif MAD | Variantes | Stock initial par variante |
| --- | ---: | --- | ---: |
| Sac cognac | 299 | Cognac / Unique | 8 |
| Abaya noire | 399 | Noir / S, M, L | 8 |
| Châle beige | 129 | Beige / Unique | 8 |

Les WebP optimisés sont dans `apps/web/public/images/catalogue-test/`. Les prompts complets et la provenance sont dans `image-prompts.json`. `products.json` est une définition reproductible, pas une synchronisation de la base active.

Validation sans accès à la base :

```sh
node scripts/install-local-test-catalog.cjs
```

L'installation est une opération manuelle, jamais exécutée au démarrage. Elle exige `--apply-local-test`, une URL MongoDB locale port 27017 et base exactement `imad_store_test`, `ALLOW_LOCAL_TEST_CATALOG=explicitly-authorized`, et `--report=/chemin/absolu/hors-du-depot.json`. Elle refuse le mode production, les autres bases et les slugs déjà présents, écrit un état initial exclusif avant la transaction, puis ajoute seulement les trois produits. Copier les images sur le serveur local avant de l'exécuter depuis le dépôt. Ne pas utiliser pour alimenter une boutique commerciale.

Retour arrière : archiver uniquement les trois slugs `catalogue-essai-*` via l'administration. Conserver les commandes et variantes associées pour préserver l'historique. Ne pas supprimer ou remettre à zéro les autres stocks. Le seeding de démonstration existant reste limité aux bases isolées ; aucun garde-fou existant n'est modifié.

## Vérification du port 3000

Le navigateur a affiché les trois fiches et images ; une variante noire M a été sélectionnée, ajoutée au panier et commandée. Total 429 MAD (399 + 30 de livraison). Une seule commande a été créée ; aucun événement CRM n'a été créé. Le stock M a diminué de 8 à 7 puis a retrouvé 8 après annulation par le service de cycle de vie existant. La commande de test annulée reste dans l'historique. Les huit événements CRM antérieurs, avec leurs tentatives, sont restés identiques.
