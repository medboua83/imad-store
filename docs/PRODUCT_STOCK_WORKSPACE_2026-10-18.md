# Produits, photos et stocks — 18 octobre 2026

L’éditeur organise la fiche en informations, photos et variantes. La publication reste explicite et les champs multilingues restent requis; aucune traduction ni donnée commerciale n’est inventée. Une suggestion transforme le nom français en adresse de produit compatible. L’ancien prix doit être supérieur au prix courant, ou laissé vide.

## Photos

Sélection multiple ou zone de dépôt; format PNG/JPEG/WebP, fichier non vide, 5 Mio maximum et 12 photos par fiche. Les fichiers sont envoyés un par un avec progression et erreurs par fichier; un échec ne retire pas les photos déjà ajoutées. Les URL identiques renvoyées par le serveur sont ignorées lors d’un nouvel import. Des boutons clavier accessibles déplacent les photos, choisissent la couverture et retirent une association. La première photo est la couverture. L’ordre est enregistré avec la fiche; les envois stockent les fichiers immédiatement, et retirer une association ne supprime pas physiquement le fichier. Aucun nettoyage automatique de fichiers inutilisés n’est ajouté.

Le serveur existant conserve le contrôle du contenu réel des images, la conversion WebP, les limites de dimensions et le stockage. Aucun nouveau service d’images ni dépendance.

## Variantes et stock

- Ajout individuel ou génération de plusieurs tailles séparées par virgule, point-virgule ou ligne. La couleur de la dernière variante sert de modèle. Les tailles répétées et les combinaisons couleur/taille déjà présentes sont ignorées. Les SKU proposés évitent les collisions dans cette fiche; l’unicité globale reste contrôlée par le serveur.
- Les variantes générées et dupliquées commencent avec stock zéro; la duplication ne copie ni identité ni réservation et demande un nouveau SKU. Maximum 100 variantes.
- Stock entier de 0 à 1 000 000, sans transformer un champ vide en zéro. Stock chargé et écart saisi visibles; SKU vides/répétés refusés avant envoi. Une variante existante est retirée de la vente par stock zéro et ne peut pas être supprimée depuis ce formulaire.
- Le champ `expectedStock` existant est préservé. Une réservation concurrente provoque le refus serveur de l’écrasement; « Recharger cette fiche » recharge les valeurs après confirmation de l’abandon des modifications. Aucun rapprochement de stock historique n’est deviné.

## Utilisation et récupération

Les compteurs portent sur les produits en vente de la sélection chargée : fiches, unités disponibles, variantes à trois unités ou moins. Recherche multilingue/SKU, publication, stock faible/rupture complète/sans variante et tri nom/stock sont combinables. Recherche et compteurs restent limités aux 100 fiches chargées au maximum, avec total serveur séparé.

Les formulaires restent montés entre rubriques. Changer/fermer/recharger une fiche modifiée demande confirmation; l’avertissement navigateur protège un rechargement de page, sans constituer une sauvegarde durable. Les contrôles d’édition sont bloqués pendant un envoi ou une sauvegarde. Les erreurs sont aussi visibles près des boutons d’enregistrement.

Une écriture réussie suivie d’un échec d’actualisation affiche « Produit enregistré » et ferme l’éditeur, en proposant d’actualiser sans recréer. Un résultat réseau incertain bloque une nouvelle sauvegarde jusqu’à vérification/rechargement de la fiche. Une fiche absente de la sélection après un résultat incertain ne déclenche aucune nouvelle création automatique. Les protections de réservation, d’authentification et de publication restent celles du backend existant.

## Validation

28 tests isolés réussis; compilation backend/frontend, lint, TypeScript et build de production réussis. Les quatre nouveaux scénarios couvrent le stock vide/non entier et le garde de concurrence, les tailles/SKU/identités générées, les limites photo avant envoi et les indicateurs/filtres de stock.

Navigateur isolé : création d’un brouillon avec deux fichiers WebP sélectionnés ensemble, couverture déplacée puis retrouvée après sauvegarde; génération M/L/XL avec dédoublonnage; duplication à stock zéro et SKU vide; refus d’un SKU répété; conservation d’une description et d’un stock saisi entre rubriques. Une panne de lecture après création est simulée : un seul produit créé et récupération par actualisation. Une variation de stock L de 2 à 1 simulée dans la base isolée provoque le refus de la saisie obsolète; rechargement puis stock L=4 enregistrés. Preuve finale : deux produits dans la base, dont un seul nouveau, deux photos et trois variantes pour ce nouveau produit, aucune commande ni entrée CRM.

La sélection multiple de fichiers et les boutons de couverture ont été vérifiés dans le navigateur. La zone de glisser-déposer est implémentée mais son dépôt de fichiers n’a pas été automatisé. Les validations de format/taille/capacité sont couvertes par les tests unitaires. Aucun test ne prétend certifier tous les appareils photo ou tous les formats de fichiers.

Largeurs 1280 et 390 pixels vérifiées sans débordement horizontal. Les noms accessibles des champs d’adresse, de couleur et de stock sont explicites. Une copie standalone fraîche évite les anciens caches d’aperçu.

Sur le port 3000, la session administrateur existante vérifie recherche, filtre stock, ouverture de la fiche de test Abaya, photo et trois variantes S/M/L avec 8 unités chacune. Compteurs : 3 fiches en vente, 40 unités, aucune variante faible. Aucun enregistrement ni envoi de fichier sur la base active. Sources appliquées après sauvegarde et frontend redémarré depuis une copie de production séparée. Backend/CRM inchangés. Les relevés avant/après contrôlent commandes/statuts/paiements, outbox états/tentatives, fiches produit complètes (textes, prix, publication, images) et toutes les données des variantes.
