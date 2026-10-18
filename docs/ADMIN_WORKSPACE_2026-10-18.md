# Administration — design et utilisation, 18 octobre 2026

L’espace administrateur adopte une interface claire ivoire/vert, des libellés français, une navigation latérale et un menu mobile. Les styles sont limités à `.admin-app`; la vitrine conserve son design.

## Gestion quotidienne

- Connexion avec étiquettes persistantes, affichage/masquage du mot de passe, progression et retour vers la boutique. Authentification et renouvellement existants conservés; aucune création ou réinitialisation de compte.
- Vue d’ensemble : compte global de commandes, commandes chargées à confirmer, montant des commandes chargées livrées (livraison incluse), produits chargés en vente, activité des sept derniers jours et avertissement de stock faible. Aucun profit ou taux de croissance arbitraire. Les commandes annulées ne sont pas comptées dans le montant livré.
- Le périmètre est explicite : au plus les 100 dernières commandes et les 100 fiches produit chargées. Recherche, filtres et indicateurs détaillés portent sur cette sélection; les totaux serveur sont affichés séparément. Ce lot ne fournit pas une recherche serveur exhaustive pour un catalogue plus grand.
- Commandes en cartes adaptatives avec recherche nom/téléphone/ville/référence et filtre de statut. Actions alignées sur le serveur : en attente → confirmée/annulée; confirmée → expédiée/annulée; expédiée → livrée. Annulation confirmée par l’utilisateur, erreurs serveur lisibles. Les règles de réservation ne changent pas.
- Produits : recherche multilingue/SKU, filtre de publication, photos, prix, stock et variantes lisibles. Éditeur complet conservé, focus sur son titre, retour explicite après sauvegarde; les formulaires produit et contenu sont conservés en mémoire lorsqu’on change de rubrique. Ils ne survivent pas à un rechargement de page.
- Rubriques Catégories, Contenu et CRM harmonisées; les publications et modifications d’intégration restent des actions explicites.
- Actualisation manuelle et périodique à 30 secondes, interrompue en arrière-plan; les erreurs partielles ne sont plus effacées par la réussite d’une autre requête. Les données précédentes restent visibles avec un avertissement. Déconnexion et expiration de session conservées.
- Titres focalisés au changement de rubrique, Échap/retour de focus pour le menu, cibles tactiles, états vides et chargements explicites.

## Validation

Compilation backend/frontend, TypeScript, lint et production build réussis. 22 tests isolés passent; deux couvrent les montants des commandes livrées et la recherche avec téléphones formatés/valeurs manquantes. Le test runner reste limité à une base MongoDB aléatoire `imad_ci_*` avec CRM simulé.

Une base d’aperçu strictement isolée a permis de tester connexion, recherche par ville/SKU, progression confirmation → expédition → livraison, modification du stock, message de réussite et conservation d’une saisie entre rubriques. Aucun de ces essais ne modifie une commande réelle ni n’envoie un événement au CRM réel. Captures et preuves locales détaillées dans le rapport de cette phase. La session administrateur existante a permis de vérifier sur le port 3000 la vue d’ensemble, la recherche de produits, l’ouverture puis l’annulation de l’éditeur sans sauvegarde et la recherche de commandes. Les commandes, états/tentatives de l’outbox CRM, prix et stocks sont identiques au relevé préalable. Aucun accès n’a été créé ou réinitialisé.

## Exécution locale

Un second `npm run dev` backend échoue avec `EADDRINUSE` si l’API écoute déjà sur 4000. Vérifier `/health` ou `/api/products`, puis arrêter la seconde tentative; ne pas démarrer plusieurs travailleurs CRM sur la même base. Le backend existant et sa date de coupure sont conservés.

Les essais de développement locaux ont aussi révélé une saturation de surveillance de fichiers (`EMFILE`). `WATCHPACK_POLLING=true` peut être utilisé localement pour réduire le recours aux observateurs système. Ce réglage est propre à l’environnement, jamais un secret à commettre. La configuration Next autorise explicitement les seuls hôtes de boucle locale `127.0.0.1` et `localhost` pour ses ressources de développement; aucune origine arbitraire n’est autorisée. Référence : https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins .

Après arrêt du frontend par le propriétaire, la version de production testée a été démarrée sur le port 3000, avec le backend existant sur 4000. La navigation et les recherches ont été vérifiées dans le navigateur après ce redémarrage. Le processus local utilise le build standalone de la copie de travail validée; les sources corrigées sont aussi appliquées au dossier local actif après sauvegarde. Le backend sain et sa date de coupure CRM sont conservés.
