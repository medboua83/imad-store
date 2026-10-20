# Promotions, livraison et Meta Pixel

## Utilisation

Dans Produits → Modifier : renseigner le prix de vente réellement facturé, cocher Produit en promotion et indiquer le prix initial supérieur pour l’affichage barré. Sans promotion, le prix initial est retiré ; le prix de vente reste explicite. Cocher Livraison offerte pour offrir les frais à tout panier contenant ce produit, y compris un panier mixte : règle choisie par le propriétaire.

Dans Livraison et Pixel : régler les frais et le seuil. Les valeurs de départ existantes sont conservées ; à défaut de document, frais 30 DH et seuil 500 DH. Le seuil est inclusif et porte sur le sous-total après promotion, hors livraison. Un seuil nul offre la livraison à toutes les commandes. Un changement de frais pendant la saisie impose une nouvelle revue du total avant l’enregistrement. Les montants et options sont relus au checkout, puis recalculés côté serveur à partir du catalogue ; une indication de livraison envoyée par un client est refusée.

Meta Pixel : identifiant numérique uniquement, activation séparée, désactivé et sans identifiant par défaut. Pas de script arbitraire ni de clé API. Après acceptation publicitaire : PageView, ViewContent, InitiateCheckout et Purchase lors de la création d’une commande COD réussie. Purchase ne signifie pas paiement encaissé. Référence d’événement stable et garde par session contre les doublons d’une même commande ; pas de reprise des commandes anciennes ni de Conversion API serveur. Aucun nom, e-mail, téléphone ou adresse n’est ajouté aux événements. Le SDK Meta reçoit les informations de navigation et de navigateur associées à ses propres requêtes après consentement.

Les visiteurs peuvent refuser puis modifier leur choix. Aucun téléchargement du SDK avant acceptation ; exclusions admin/auth, localhost, mode de test, DNT et GPC. Le refus utilise la commande de révocation du SDK. L’envoi publicitaire ne doit jamais faire échouer une commande. L’intégration réelle reste à vérifier dans le gestionnaire Meta avec l’identifiant du propriétaire : aucun événement réel envoyé pendant cette recette.

## Compatibilité et périmètre

Champs MongoDB additifs : Product.freeShipping (défaut false), StoreSettings.metaPixelEnabled (défaut false), metaPixelId facultatif. Régénérer le client Prisma avec le code, sans db push ni migration destructive. Les bases et réglages restent indépendants par installation d’entreprise. Les anciens clients sans option conservent les règles de seuil existantes. Les commandes historiques conservent leurs frais et prix enregistrés.

La copie de recette locale utilise une base propre et deux produits fictifs, un backend isolé sur 4012 et le frontend sur 3000. Ni catalogue de production, commandes réelles, CRM ni réglages d’hébergement modifiés. Aucun vrai pixel activé.

## Validation

Compilation backend et frontend, lint, 50 tests isolés : seuil 499,99/500, panier mixte offert, ligne de quantité nulle non éligible, absence de promotion valide, validation des réglages et identifiants, autorisation admin, recalcul serveur, stock transactionnel, idempotence existante ; pixel sans requête externe, refus/exclusions et dédoublonnage. Recette navigateur : formulaire de livraison enregistré puis rechargé, promotion et livraison par produit, totaux panier/checkout, rendu mobile et ordinateur. Le rapport de publication/PR précise l’état final du dépôt ; aucun déploiement production n’est implicite.
