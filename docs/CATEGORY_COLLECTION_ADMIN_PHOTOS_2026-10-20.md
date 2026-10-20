# Collection catégories et images admin

Demande propriétaire : générer puis publier les quatre catégories restantes dans le style ivoire des sabots, sans texte, et corriger la photo Saboliya cassée dans l’administration.

## Provenance des visuels

Outil imagegen intégré, sans références photographiques. Originaux PNG conservés dans les livrables `outputs/imagegen` de la tâche, sans écraser les anciennes images. Visuels illustratifs réservés aux catégories, sans prétendre représenter les articles réels. Versions WebP 640 × 640 embarquées :

- `abayas-v2.webp` : 10 416 octets ; abaya charbon, entière, manches longues, plis sobres, sans personne ni mannequin visible.
- `chaussures-femme-v2.webp` : 21 324 octets ; paire de ballerines cuir bleu marine, petit nœud, trois quarts.
- `chales-v2.webp` : 53 176 octets ; châle tissé bleu nuit, plis souples, petites franges.
- `sacs-v2.webp` : 38 774 octets ; un seul sac cuir cognac structuré, deux anses, métal discret. Une proposition avec chaussures a été écartée.

Consignes communes finales : photographie photoréaliste de studio, fond ivoire, lumière douce, ombres légères, composition carrée centrée pour vignette ronde, sans personne, accessoire extérieur, emballage, texte, lettres, logo ou filigrane. Prompts complets dans les livrables de génération de la tâche.

## Correction admin

La liste utilisait seulement `p.images[0]`, alors que cette référence historique répond 404 et qu’une autre photo du même produit est disponible. `AdminProductPhoto` tente les références du même produit dans l’ordre puis affiche un état neutre français si aucune ne charge. Dans l’éditeur, chaque aperçu ne reçoit que sa propre référence : un échec reste signalé « Photo indisponible » sans substituer une autre vue ni modifier la liste enregistrée. Les actions de remplacement, retrait et couverture restent explicites et soumises à Enregistrer.

Cette correction traite l’affichage des fichiers manquants ; elle ne restaure pas les originaux perdus. Le test antérieur d’un nouveau fichier uploadé à travers un redéploiement reste bloqué par l’accès aux fichiers locaux de l’extension Chrome. Les visuels de catégories embarqués ne dépendent pas de cet upload.

Validation : contrôle ciblé des priorités de catégories, lint et compilation de production, CI complète puis recette publique mobile/ordinateur et lecture des produits dans l’administration publiée. Aucun catalogue, commande, CRM ou message modifié pour la recette.
