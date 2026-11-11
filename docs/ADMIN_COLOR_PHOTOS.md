# Relier les couleurs aux photos

Dans Produits, ajoutez ou modifiez une fiche. Le bloc **Photos et couleurs** se trouve directement sous les photos. Ajoutez les photos originales, puis définissez les couleurs dans les variantes. Un lien depuis la partie Stock permet de revenir au bloc.

Chaque couleur possède une carte, valable pour toutes ses tailles. **Choisir une photo** ouvre les miniatures : cliquez sur la bonne image. Le numéro et la vignette confirment le choix. La couverture peut être choisie explicitement comme toute autre image. **Effacer l’association** retire seulement le lien ; la photo reste dans la galerie et sur le serveur.

Une couleur non reliée affiche un état à associer et utilise la couverture dans la boutique. L’aperçu explique cet état lorsqu’on clique sur cette couleur. Les produits existants sans association ne sont pas modifiés automatiquement : leurs images ne permettent pas de deviner une correspondance fiable à partir de l’ordre seul.

Prévisualisez la fiche, cliquez sur les couleurs pour vérifier les images, puis enregistrez le produit. Une sélection dans le bloc seul n’enregistre pas la fiche. Les associations reposent sur l’URL de la photo ; elles survivent à un réordonnancement de la galerie. Retirer la photo associée remet la couleur à l’état à associer et le lien retiré est exclu lors de l’enregistrement.

Renommer toutes les variantes d’une couleur sans changer son code conserve la photo de ce groupe. Renommer une seule variante crée un groupe distinct à associer ; changer le code couleur exige aussi un nouveau choix. Si la couleur de destination possède déjà sa photo, celle-ci n’est pas remplacée. Les liens restent au format existant colorKey/image ; aucun changement de schéma ni migration.

Recette : tests/ui/admin-color-photo-picker.spec.ts et tests/ui/product-color-photos.spec.ts. Données et sauvegardes simulées : création avec upload, 25 miniatures, aperçu, absence d’écriture avant sauvegarde, renommage, nouveau groupe, nouveau code, liens conservés après rechargement, effacement de photo et image par couleur sur la boutique.
