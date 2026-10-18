# Corrections prioritaires — 18 octobre 2026

Cette livraison traite les dix constats P1 de l’audit. Les constats P2 restent dans la feuille de route.

| Constat | Correction |
|---|---|
| A01 | Le suivi public renvoie uniquement identifiant, statut, état du paiement et date ; cache désactivé. |
| A02 | Secret Telegram obligatoire et comparaison constante ; association uniquement après partage du propre contact dans une conversation privée. Les anciennes associations non vérifiées ne reçoivent plus de données. |
| A03 | Les deux anciennes routes de paiement par carte renvoient 410. Le paiement à la livraison demeure le seul moyen disponible. Une réouverture de Stripe nécessitera une implémentation liée au montant calculé côté serveur. |
| A04 | Transitions de commande centralisées pour administration et Sheets ; annulation et restitution du stock dans une transaction avec reprise des conflits. Réservation explicite pour les nouvelles commandes. |
| A05 | Formulaire produit FR/AR/EN complet, variantes, SKU, tailles et stock ; modification du stock protégée contre un écrasement concurrent. |
| A06 | Téléversement administrateur authentifié, limite 5 Mo/20 millions de pixels, validation du format réel, conversion WebP, nom par empreinte et stockage persistant. |
| A07 | Fiches de démonstration exclues du catalogue public ; publication conditionnée aux noms, photos et variantes disponibles ; brouillons visibles dans le catalogue administrateur. |
| A08 | Pagination bornée, statuts et identifiants validés ; catalogue administrateur séparé et protégé ; erreurs techniques masquées. |
| A09 | Next 16.4.2, React 19.3.1, Tailwind 4.3.3 et dépendances corrigées ; analyse npm sans vulnérabilité au moment de la livraison. ESLint utilise directement les règles TypeScript, React Hooks et accessibilité pour retirer une dépendance de recherche de fichiers sans correctif. |
| A21 | Tests HTTP avec vraie base MongoDB isolée et CRM simulé local ; vérification CI sur chaque demande de fusion et mise à jour de Master. |

## Vérification reproductible

Prérequis : Node 22 ou plus récent, MongoDB avec replica set `rs0` sur `127.0.0.1:27017`.

```sh
npm ci
npm --prefix backend run prisma:generate
npm run check
npm test
npm audit --audit-level=high
```

Le lanceur crée une base `imad_ci_<identifiant aléatoire>`, coupe les notifications externes et supprime uniquement cette base après les tests. Il refuse une autre URL de base. Le CRM simulé reçoit les essais de livraison, jamais le CRM réel. Aucun `prisma db push` n’est nécessaire sur une base existante : les nouveaux champs MongoDB sont optionnels.

Les douze scénarios couvrent la confidentialité, les paramètres invalides, Telegram, le paiement fermé, les produits et variantes, les images, les doubles soumissions, les reprises CRM, les annulations répétées, le dépassement du stock, Sheets et les commandes historiques.

## Exploitation et limites connues

- Sauvegarder `backend/uploads` (ou `UPLOAD_DIR`) avec les données. Le frontal expose ces images via `/uploads` vers l’API.
- Telegram reste fermé si son nouveau secret n’est pas configuré. Configurer le même secret lors de l’enregistrement du webhook ; ne pas réutiliser les anciennes associations sans partage de contact vérifié.
- Les commandes historiques sans preuve de réservation ne peuvent pas être annulées automatiquement : rapprocher le stock avant d’enregistrer une réservation vérifiée. La livraison ne devine pas leur effet passé sur le stock.
- Les anciennes fiches de démonstration sont conservées en brouillon. Renseigner les vraies photos, les noms, les prix et les variantes avant de mettre de vrais articles en vente. Une boutique vide affiche un message et un lien de contact.
- Le lancement ne réintroduit plus automatiquement les produits de démonstration. `IMAD_SEED_DEMO=true` est réservé à une base de démonstration.
- Conserver le seuil historique du worker CRM ; ne pas relancer les anciennes lignes en attente. Les tests ne garantissent pas la déduplication interne d’un CRM tiers après une réponse réseau perdue ; ils vérifient l’unicité de l’événement local et la stabilité de sa clé à chaque reprise.
