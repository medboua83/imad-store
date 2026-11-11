# Prévisualiser avant d’enregistrer un produit

Dans Produits, ouvrez une fiche ou choisissez Ajouter un produit. Le bouton **Prévisualiser le produit** se trouve dans l’en-tête ; **Prévisualiser les photos** est aussi disponible sous la galerie. Ils ouvrent le même aperçu de la saisie actuelle, y compris pour un produit incomplet ou non enregistré.

L’aperçu montre les originaux sans les modifier, leur ordre actuel et la couverture. Parcourez les images avec les boutons, les vignettes ou les flèches gauche/droite. Les formats Mobile et Ordinateur permettent de changer la présentation dans la fenêtre. Sur un écran étroit, la présentation reste en une colonne pour préserver la lisibilité. Les couleurs affichent leur photo associée lorsqu’une association valide a été saisie, sinon la couverture. Le prix barré respecte l’activation de la promotion ; le prix affiché concerne une pièce, hors livraison.

Une image indisponible reste signalée à sa place afin de pouvoir la corriger depuis la galerie. Les vignettes des fichiers téléchargés utilisent les aperçus allégés existants, avec repli sur l’original ; la photo principale utilise l’original. L’aperçu n’envoie aucun formulaire, ne crée pas de produit, ne modifie pas le panier et ne publie rien sur un réseau social.

Fermez par le bouton, Échap ou Revenir à la fiche. Les champs, photos et associations ne sont pas changés par la prévisualisation. Enregistrez ensuite la fiche selon le statut choisi. Les protections existantes de validation, de stock et de reprise d’une création incertaine restent inchangées.

Tests : tests/ui/admin-product-preview.spec.ts utilise des données simulées, des galeries de 25 photos, une image indisponible, des variantes/couleurs, des formulaires incomplets et les formats 320/390/1440 px. Les tests vérifient notamment l’absence d’écriture pendant l’aperçu, la conservation de la saisie et l’enregistrement explicite unique après fermeture.
