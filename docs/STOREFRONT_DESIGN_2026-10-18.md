# Refonte UI/UX — 18 octobre 2026

Direction visuelle éditoriale : ivoire, vert profond, lignes fines et photographie existante plus présente. L'accueil distingue introduction, catégories, sélection de produits et explication des trois étapes du parcours. Aucun avis, promotion, délai ou avantage commercial inventé n'a été ajouté.

Tajawal remplace Amiri pour les textes, menus et formulaires arabes. Amiri reste réservé aux grands titres; Cormorant Garamond signe le mot-symbole IMAD. Les nouvelles fontes sont hébergées localement, avec leurs licences SIL : Tajawal en WOFF2 par alphabet et graisse (400/500/700), Cormorant limité aux lettres du mot-symbole et chiffres du guide. Les fontes critiques sont préchargées avec font-display optional. Sources officielles : https://fonts.google.com/specimen/Tajawal et https://fonts.google.com/specimen/Cormorant+Garamond ; licences du dépôt google/fonts.

## Changements visibles

- En-tête avec page active, icône de panier et compteur, menu mobile conservant son dialogue natif accessible.
- Accueil avec composition image/texte, lien direct vers les catégories et actions explicites.
- Catégories en tuiles, grille produit et pied de page cohérents; aucune image de catégorie inventée.
- Fiches affichant prix, disponibilité et nombre réel de variantes, avec direction gauche-droite pour les prix latins.
- Titres des cartes de niveau 3 dans la section d'accueil et niveau 2 dans le catalogue.
- Recherche et filtres mieux hiérarchisés; les choix par défaut ne déplient plus les options avancées après une recherche.
- Présentation des fiches produit, champs de formulaire et récapitulatif de commande harmonisée.
- Mise en page adaptative, contrôles de taille suffisante, focus visible et préférences de mouvement réduit conservés.

## Vérification

Compilation, contrôle TypeScript et lint réussis. Essais navigateur sur la version candidate : accueil, catalogue, recherche abaya, une seule fiche trouvée, sélection de la taille M, ajout au panier, total 399 + 30 = 429 MAD, accès au formulaire, validation des champs vides sans création de commande. Menu mobile : ouverture, fermeture Échap et retour du focus au bouton. Panier de vérification vidé ensuite. Le catalogue de test conserve ses mentions fictives.

La refonte ne modifie ni le backend, ni les règles de réservation, ni la livraison CRM. Aucun nouvel envoi CRM ou commande n'est requis pour cette vérification visuelle. Les données de départ sont comparées après application locale. Les captures, limites de largeur réellement observées, mesures et emplacement de sauvegarde sont conservés dans le rapport local de cette phase.
