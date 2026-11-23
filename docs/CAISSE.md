# Caisse intégrée

La rubrique **Caisse** enregistre les ventes emportées avec le catalogue et le stock de la boutique. Une vente magasin n’est pas une commande web : elle ne crée aucun colis, prospect CRM, message WhatsApp ou paiement à la livraison.

## Utilisation

1. Ouvrir Caisse et rechercher un nom ou une référence SKU. Chaque carte correspond à une variante : couleur, taille et stock disponible.
2. Ajouter les articles. Les offres par quantité du produit s’appliquent aussi en caisse ; le serveur vérifie le prix final et le stock avant validation.
3. Choisir Espèces et saisir le montant reçu : la monnaie à rendre s’affiche. Pour Carte — TPE externe, effectuer d’abord le paiement sur le terminal habituel, puis confirmer son succès dans la caisse. Le site ne débite pas de carte.
4. Valider une seule fois, puis imprimer le ticket ou l’enregistrer en PDF depuis la fenêtre d’impression du navigateur. Le format papier et l’imprimante restent à choisir dans cette fenêtre.
5. Cliquer sur Nouvelle vente. Les anciens tickets restent accessibles depuis Historique magasin, par référence et, pour un responsable, par caissier.

Le lecteur doit saisir une référence SKU existante puis Entrée. Cette version ne crée pas de correspondances EAN distinctes. Les imprimantes et lecteurs physiques doivent être vérifiés avec le matériel effectivement utilisé ; les tests navigateur ne certifient pas un périphérique particulier.

## Accès

Les administrateurs disposent de la caisse. Dans Équipe et accès, le droit **Encaisser et consulter ses ventes magasin** permet à un collaborateur d’enregistrer des ventes et de consulter uniquement ses propres tickets. **Consulter les ventes de tous les caissiers** permet une lecture globale sans donner le droit d’encaisser. Les comptes existants ne reçoivent pas automatiquement ces nouveaux droits.

## Coupure et reprise

La caisse conserve un brouillon par compte, dans le navigateur. Une tentative est enregistrée localement avant l’appel d’encaissement. Si son résultat est incertain, elle reste bloquée : utiliser **Vérifier cet encaissement**, puis si nécessaire **Réessayer le même encaissement**. Ne pas ouvrir une nouvelle vente dans un autre navigateur pour remplacer cette tentative. Les reprises utilisent la même référence et les mêmes montants. Les fenêtres d’un même navigateur se partagent le brouillon et un verrou d’encaissement.

Aucun mode hors ligne n’est proposé : l’enregistrement nécessite une connexion au serveur. Un navigateur récent sur HTTPS et un stockage local fonctionnel sont requis. Ne pas effacer le stockage d’une caisse contenant un encaissement à vérifier.

## Règles techniques et exploitation

- Tables additives `pos_sales` et `pos_sale_items`, indépendantes de `orders`, avec un identifiant idempotent unique par tentative.
- Prix calculés côté serveur avec les offres du catalogue existant. Hash de devis relu à la validation, verrou sur produits/variantes et décrément conditionnel du stock en transaction.
- Les relectures d’une tentative déjà validée retrouvent son ticket avant toute nouvelle vérification du stock ou des prix. Une référence ne peut pas être réutilisée pour un autre caissier ou un autre contenu.
- Noms, références, variantes, montants, mode de paiement et identité du caissier sont conservés sur le ticket. Changer ou supprimer le produit ne réécrit pas une vente passée.
- Aucun endpoint de modification ou suppression de vente. Retours, remboursements, échanges et clôture de caisse nécessiteront un parcours dédié dans une phase suivante. Ne pas compenser une erreur d’encaissement en modifiant une commande web.
- Historique paginé de 25 ventes, lecture cohérente, statistiques du jour selon Africa/Casablanca. Ces chiffres ne constituent pas une clôture comptable et ne sont pas mélangés au taux de conversion web.
- Reçu de vente uniquement : aucune TVA, mention fiscale, numéro de facture réglementaire ou identité commerciale non renseignée n’est inventé.
- Publication : sauvegarde vérifiée, migration additive, droits SQL explicites sur les deux nouvelles tables, recette sur clone privé avec travailleurs externes arrêtés, puis contrôles en lecture seule en production. Ne pas créer de vraie vente pour vérifier le déploiement.
