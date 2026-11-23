# Caisse intégrée

La rubrique **Caisse** enregistre les ventes emportées avec le catalogue et le stock de la boutique. Une vente magasin n’est pas une commande web : elle ne crée aucun colis, prospect CRM, message WhatsApp ou paiement à la livraison.

## Utilisation

1. Ouvrir Caisse et rechercher un nom ou une référence SKU. Chaque carte correspond à une variante : couleur, taille et stock disponible.
2. Ajouter les articles. Les offres par quantité du produit s’appliquent aussi en caisse ; le serveur vérifie le prix final et le stock avant validation.
3. Choisir Espèces et saisir le montant reçu : la monnaie à rendre s’affiche. Les chiffres latins, arabes et persans sont acceptés, ainsi que le séparateur décimal point, virgule ou « ٫ » ; ne pas saisir de séparateur de milliers. Pour Carte — TPE externe, effectuer d’abord le paiement sur le terminal habituel, puis confirmer son succès dans la caisse. Le site ne débite pas de carte.
4. Valider une seule fois, puis imprimer le ticket ou l’enregistrer en PDF depuis la fenêtre d’impression du navigateur. Le format papier et l’imprimante restent à choisir dans cette fenêtre.
5. Cliquer sur Nouvelle vente : la recherche et le montant sont effacés, et le mode Espèces est rétabli. Les anciens tickets restent accessibles depuis Historique magasin, par référence et, pour un responsable, par caissier.

Le lecteur doit saisir une référence SKU exacte existante puis Entrée. La recherche de ce code porte sur toutes les variantes actives, indépendamment des pages du catalogue. Une saisie modifiée pendant la recherche annule le résultat précédent. Cette version ne crée pas de correspondances EAN distinctes. Les imprimantes et lecteurs physiques doivent être vérifiés avec le matériel effectivement utilisé ; les tests navigateur ne certifient pas un périphérique particulier.

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
- Aucun endpoint de modification ou suppression de vente. Les retours et échanges utilisent un registre distinct, sans réécrire la vente. Ne pas compenser une erreur d’encaissement en modifiant une commande web.
- Historique paginé de 25 ventes, lecture cohérente, statistiques du jour selon Africa/Casablanca. Ces chiffres ne constituent pas une clôture comptable et ne sont pas mélangés au taux de conversion web.
- Reçu de vente uniquement : aucune TVA, mention fiscale, numéro de facture réglementaire ou identité commerciale non renseignée n’est inventé.
- Publication : sauvegarde vérifiée, migration additive, droits SQL explicites sur les deux nouvelles tables, recette sur clone privé avec travailleurs externes arrêtés, puis contrôles en lecture seule en production. Ne pas créer de vraie vente pour vérifier le déploiement.

## Retrouver une vente

Dans Historique magasin, saisir une référence complète (POS-… ou #POS-…) ou sa partie finale, choisir le mode de paiement et les dates souhaitées, puis cliquer sur Appliquer les filtres. Les dates incluent la journée entière selon l’heure du Maroc. Un responsable peut combiner ces critères avec un caissier ; un collaborateur ne voit que ses propres ventes. La recherche porte sur tout l’historique, paginé par 25 tickets, et revient à la première page lors de l’application.

Le nombre de résultats porte sur les filtres appliqués. Le résumé « Aujourd’hui, dans cette vue » reste limité aux ventes du jour correspondant à ces mêmes filtres ; il peut donc être nul pour une période passée. Réinitialiser les filtres retrouve l’ensemble autorisé. Actualiser réessaie la recherche appliquée après une erreur, en conservant les champs saisis. Ouvrir ou réimprimer un ticket ne crée aucune vente.

## Ouvrir et clôturer sa caisse

Dans **Ma caisse**, saisir le fond d’ouverture réellement disponible et confirmer **Ouvrir ma caisse**. Cette première ouverture active le suivi des sessions pour ce caissier ; les anciennes ventes restent dans l’historique sans être ajoutées à la nouvelle session. Une fois le suivi activé, une session ouverte est nécessaire pour les nouvelles ventes. Les collaborateurs gèrent uniquement leur propre caisse. Un responsable avec pos.read consulte les récapitulatifs de tous les caissiers, sans pouvoir ouvrir ou fermer à leur place.

Terminer ou vider le panier et vérifier toute tentative d’encaissement incertaine, puis choisir **Préparer la clôture**. Compter les espèces et saisir le résultat. Le montant attendu est le fond d’ouverture plus les ventes et compléments d’échange en espèces, moins les remboursements, après monnaie rendue ; les cartes enregistrées sur TPE sont séparées. Expliquer tout écart, puis confirmer **Clôturer ma caisse**. Les ventes et le stock ne sont pas ajustés par cet écart. Si une vente a été ajoutée pendant le comptage, actualiser et recompter avant de confirmer.

Le récapitulatif fermé conserve les montants, dates, caissier et explication, et peut être consulté ou imprimé depuis Historique des sessions. Pour reprendre les ventes, ouvrir une nouvelle session avec le fond disponible : le système ne suppose aucun transfert d’espèces automatique. Aucun retrait, dépôt de fonds, remboursement ou opération bancaire n’est effectué par cette fonction.

Après une coupure, **Vérifier l’opération** relit le résultat ; **Réessayer la même opération** réutilise sa référence et ses montants. Ne pas effacer le stockage d’une opération à vérifier. Les anciennes tentatives de vente déjà enregistrées restent récupérables après la clôture. Ce récapitulatif de comptage ne constitue pas une clôture fiscale ou une certification de caisse.


## Retours et échanges

Dans **Historique magasin**, utiliser **Retours et échanges** sur le ticket, ou saisir sa référence complète POS-… dans la rubrique correspondante. Un reçu RET-… permet de retourner ultérieurement une pièce obtenue lors d’un échange. Le droit dédié **Effectuer les retours et échanges en caisse** et le droit d’encaisser sont nécessaires ; consulter les tickets d’autres caissiers demande également le droit de lecture globale. Les collaborateurs existants ne reçoivent pas automatiquement ces droits.

Choisir la quantité, puis obligatoirement **Revendable — remettre en stock** ou **Non revendable — ne pas remettre en stock** pour chaque ligne sélectionnée. Une variante supprimée ou dont la référence, la taille ou la couleur a changé ne peut pas être remise automatiquement en stock. Indiquer un motif. Pour un échange, rechercher les variantes de remplacement, ajouter les quantités et vérifier le total.

Le retour utilise le montant payé sur le ticket, remises comprises, avec une répartition cumulative des centimes pour les retours partiels. Il ne recalcule pas rétroactivement le prix des pièces gardées. Les nouveaux articles utilisent les prix et offres actuels. L’écran indique uniquement la différence : remboursement en espèces, complément à encaisser en espèces ou déjà payé sur TPE externe, ou échange sans mouvement d’argent. Aucun virement ni remboursement bancaire automatique n’est effectué.

Ouvrir **Ma caisse** avant toute opération ; les espèces disponibles doivent suffire au remboursement. Une ancienne vente peut être retournée dans une nouvelle session : les anciennes clôtures restent inchangées. Attendre la confirmation du reçu, puis remettre le remboursement, les pièces et la monnaie une seule fois. Réimprimer ou relire un reçu ne signifie jamais refaire un paiement physique.

En cas de coupure, conserver le navigateur et utiliser **Vérifier le retour**, puis si nécessaire **Réessayer la même opération**. La tentative conserve sa référence et ses montants avant tout envoi. Tant qu’elle est incertaine, ne pas la remplacer dans un autre appareil et ne pas effacer le stockage. Les opérations d’une même session navigateur partagent le verrou de vente et de clôture.

Le serveur vérifie les quantités déjà retournées en transaction, y compris entre deux caissiers. Réintégration du stock, sortie des remplacements et enregistrement du reçu forment une seule opération atomique. Les reçus de vente et de retour sont conservés sans modification. L’historique des ventes reste brut ; celui des retours/échanges est séparé et le récapitulatif de session inclut leurs différences signées. Les commandes web, statuts de paiement existants, CRM et colis ne sont pas modifiés par ce parcours.

Migration additive 20261123180000_pos_returns_exchanges : deux tables append-only et trois colonnes à zéro sur les clôtures existantes. L’application d’une ancienne version ne doit pas être utilisée pour continuer à clôturer une session contenant des retours : une protection SQL refuse d’ignorer ce registre. Conserver le schéma et restaurer une version compatible.
