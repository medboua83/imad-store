# Recherche et retour au stock

Produits et Stock permettent de rechercher plusieurs mots, même avec des accents, des signes arabes ou des chiffres arabes/persans. Exemple : « echarpe noir ٤٠ » retrouve « Écharpe » avec une variante noire de taille 40. Les tailles et couleurs doivent appartenir à une même variante ; la recherche n’associe pas une taille d’un coloris à un autre. Les données enregistrées restent inchangées.

Dans Stock, la recherche, la page et le filtre sont conservés quand on ouvre une fiche, change de rubrique ou utilise Retour/Avance du navigateur. Ils sont limités à la session actuelle et ne sont pas sauvegardés sur le serveur ni dans une adresse publique. La vue d’ensemble remet ces filtres à zéro lorsqu’on ouvre une tâche de stock faible ou de rupture, afin que la file demandée soit visible. Une déconnexion efface ce contexte.

Les boutons de pagination sont disponibles en haut et en bas de la liste. Le résumé précise la plage affichée ; un changement de page place le focus sur ce résumé et revient au début des résultats. Effacer la recherche et les filtres revient à toutes les variantes, page 1.

Les résultats restent limités aux fiches déjà chargées, actuellement cent au maximum. La limite est annoncée dans le tableau de bord ; une recherche globale au-delà exige une évolution serveur distincte.

Recette : tests/ui/admin-catalogue-search.spec.ts, écrans 320/390/1440 px, accents français/arabes, chiffres arabes/persans, coloris/tailles distincts, pagination, Retour/Avance, conservation d’un brouillon produit, raccourcis de la vue d’ensemble, remise à zéro et champs RTL. Les requêtes de recette sont simulées : aucune commande, modification de stock ou sauvegarde de produit réel.
