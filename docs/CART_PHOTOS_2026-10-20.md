# Miniatures panier et récapitulatif — 20 octobre 2026

Les anciens paniers conservaient uniquement la première photo, même si elle avait disparu. Le récapitulatif utilisait aussi une image sans gestion des erreurs.

Les ajouts et l’actualisation du panier conservent désormais la galerie du produit courant. L’ancien champ `image` reste compatible avec les paniers persistés existants. La liste et la miniature repliée utilisent `ProductPhoto`, qui essaie les autres photos du même produit puis affiche un emplacement IMAD si aucune n’est disponible.

L’actualisation des photos ne signale pas un changement de montant et ne modifie pas la quantité. Aucun fichier original, catalogue ou commande n’est modifié.

Validation ciblée : ancien panier sans galerie, couverture périmée, récupération des photos actuelles sans changement du total ; contrôles existants de prix, stock et panne réseau conservés. La compilation et le paquet hébergé sont contrôlés en CI avant publication.
