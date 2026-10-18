# Suivi et détails des commandes — 18 octobre 2026

La rubrique Commandes ajoute des filtres de statut avec compteurs, une recherche existante, un tri par date ou montant, une période inclusive en heure du Maroc et un filtre de paiement. Tous portent sur les 100 dernières commandes chargées au maximum; les compteurs de statut portent sur toute cette sélection, indépendamment des autres filtres. Le total serveur reste distinct. Une période inversée produit une explication explicite. Réinitialiser remet aussi le tri par défaut.

## Fiche de commande

Le bouton « Voir les détails » ouvre un dialogue natif accessible au clavier : focus contenu dans la fiche, fermeture par Échap, retour au bouton et arrière-plan non défilant. Chaque ouverture revient au début. La fiche présente contact/adresse disponibles, paiement, articles et variantes, quantité × prix unitaire enregistré, livraison, total sauvegardé et note du client. Une référence complète est disponible dans une section secondaire. Les données manquantes sont indiquées; un détail de montant incomplet ou incohérent n’est pas présenté comme rapproché. Les noms/variantes proviennent des relations catalogue actuelles, tandis que quantités/prix unitaires sont ceux de la commande.

La progression représente le statut actuel, sans inventer de dates de passage. Une commande annulée a un état final explicite. Livrée et payée restent deux informations distinctes. Ce lot ne permet pas de marquer un paiement reçu, de modifier l’adresse, d’ajouter un transporteur ou de suivre un colis en temps réel.

## Changements de statut

Chaque action demande une confirmation identifiant la référence, le client et le total. Une annulation explique le traitement du stock réservé. Le verrou synchrone bloque les envois répétés pendant une requête. Si le résultat d’une écriture est incertain, ou si l’écriture réussit mais que la lecture suivante échoue, les actions sont désactivées jusqu’à une actualisation manuelle réussie; le message distingue ces deux cas. Le serveur conserve l’autorité sur les transitions et la réservation du stock.

Aucun changement du backend, des dépendances, de l’authentification, du schéma ou des paramètres CRM. Aucune ancienne entrée CRM rejouée.

## Vérifications

- Compilation backend/frontend, lint, TypeScript et production build réussis.
- 24 tests isolés réussis : notamment dates inclusives selon le Maroc, filtre paiement combiné, tri sans mutation et rapprochement des montants enregistrés.
- Navigateur isolé : fiche complète et total 2 × 100 + 30 = 230 MAD; confirmation → expédition → livraison; annulation d’une autre commande avec restauration du stock; aucun événement CRM. Une troisième commande teste une panne de lecture après écriture réussie : message distinct, actions bloquées, puis réactivées après actualisation.
- Mobile 390 pixels : document sans débordement, dialogue 350 pixels de large avec contenu de même largeur; fermeture Échap, retour du focus et remise en haut vérifiés. Période inversée, filtre paiement sans résultat et réinitialisation vérifiés dans le navigateur.
- L’aperçu réutilise les mêmes fichiers frontend compilés; seules les destinations du proxy de sa copie standalone privée sont changées vers l’API et le simulateur isolés. Le build normal conserve le backend 4000.
- Port 3000 redémarré avec le build normal. Session administrateur existante : recherche, ouverture de la commande de test précédemment annulée, adresse/articles/variante/prix/livraison/total et fermeture au clavier vérifiés. Aucun changement de statut sur la base active. Aucun avertissement/erreur console observé lors du contrôle final.
- Relevés avant/après identiques : références/statuts/paiements/montants des 9 commandes, 8 lignes outbox avec mêmes états/tentatives, prix/statuts produits et stocks des variantes.

Les sources frontend actives sont sauvegardées avant application. La version standalone précédente est conservée localement pour retour arrière; les sauvegardes, données privées et captures ne sont jamais commises.
