# Statuts Olivraison dans Commandes — 21 novembre 2026

## Comportement

La liste des commandes administrateur inclut le colis associé à chaque commande chargée : numéro de suivi, code transporteur, état du traitement, erreur et date de la dernière lecture réussie. Une requête groupée limitée aux commandes de la page évite une requête par carte. Les réponses publiques de suivi ne sont pas enrichies et aucune clé transporteur n'est renvoyée.

Le bloc Olivraison est visible dans les cartes et les détails, en français et en arabe. Le bouton « Vérifier chez Olivraison » relit seulement le colis existant. Il fonctionne aussi lorsque la création automatique est désactivée, à condition que les clés soient encore enregistrées. Il ne crée ni ne confirme un colis et ne demande aucun ramassage. Les colis déconnectés restent bloqués ; les références absentes ou différentes demandent un rapprochement humain.

Le suivi automatique existant dépend toujours de la configuration Olivraison activée. Les colis actifs redeviennent éligibles 30 secondes après une lecture réussie. L’ordonnanceur se réveille toutes les cinq secondes et traite au plus dix colis échus, en série, sans chevauchement de lot. Le débit distribué de quatre appels par seconde et le bail de cinq minutes restent séparés de ce délai. La latence du transporteur, le volume et les reprises après erreur peuvent allonger le délai : il ne s’agit pas d’une garantie de temps réel. Les erreurs de lecture du mode TRACKING_ONLY gardent un délai de cinq minutes ; les autres erreurs gardent leur reprise exponentielle. Les échéances déjà enregistrées ne sont pas avancées lors du déploiement. La rubrique Commandes relit sa liste toutes les cinq secondes quand elle est active et visible ; les autres ressources gardent leur synchronisation de trente secondes. Les requêtes se suspendent à la fermeture ou au changement de rubrique et les réponses obsolètes sont écartées. Une panne garde les données précédentes, les filtres et la fiche ouverte. Ce lot n'active aucune connexion, ne reprend aucun historique et ne relie pas automatiquement les colis créés manuellement chez le transporteur.

## Correspondances

| Olivraison | Commande boutique |
| --- | --- |
| CREATED, CONFIRMED, PICKUP | Pas de transition commerciale |
| PICKEDUP, PICKED_UP, INHOUSE, RECIVED, ENROUTE, ASSIGN, TRANSIT, SCHEDULED, REPORTED, UNKNOWN_CALL | CONFIRMED → SHIPPED |
| DELIVERED | CONFIRMED → SHIPPED → DELIVERED, ou SHIPPED → DELIVERED |
| CANCELED, CANCELLED, RETURNED, DELETED, CUSTOMER_CANCELED | Statut transporteur affiché, rapprochement requis |
| Code inconnu | Code conservé et affiché, aucune transition inventée |

Les commandes en attente ou annulées ne sont pas confirmées par le transporteur. Aucun statut commercial ne recule. Le paiement à la livraison reste en attente de rapprochement du versement ; aucun retour n'entraîne automatiquement remboursement ou restitution du stock. Une annulation transporteur continue d'être relue pour détecter un retour ultérieur. Les notifications identiques ne sont pas recréées à chaque contrôle.

## Intégrité et déploiement

`POST /api/orders/:id/olivraison-sync` est réservé aux administrateurs et partage le bail du worker. Il exige le numéro de suivi déjà enregistré, retourné à l’identique par la lecture authentifiée du compte Olivraison. `partnerTrackingID` est facultatif dans cette réponse : lorsqu’il est fourni, il doit être l’identifiant exact de la commande ; une référence vide, nulle ou contradictoire est refusée. Aucun rapprochement n’est fait à partir du nom ou du téléphone du client. Les vérifications répétées n'ajoutent ni commande, ni colis, ni événement de transition identique. Un échec conserve le dernier statut et sa date de réussite.

Migration additive : `20261121180000_carrier_tracking_sync`, colonne nullable `lastSyncedAt` dans `olivraison_shipments`. Une valeur vide représente un ancien colis pas encore relu, jamais une date de vérification inventée. Sauvegarde et migration contrôlée nécessaires avant publication ; aucun `db push`.

Tests : réponses transporteur fictives, concurrence, lecture seule avec automatisation arrêtée, absence de fuite publique, contrôle des références, absence de régression, retour et paiement/stock inchangés. Tests navigateur prévus à 390 et 1440 pixels en français/arabe, avec erreur puis réessai. Les résultats et captures sont sur DATA dans `outputs/order-carrier-sync-20261121`. PR150/151 publiées et compte réel vérifié. La réduction du délai fait l’objet d’une recette séparée sur DATA dans `outputs/carrier-30s-20261121` ; aucun nouveau colis de test en production.

Références vérifiées : [Partners API](https://partners.olivraison.com/docs), [guide de suivi Olivraison](https://www.olivraison.com/fr/tracking).


Le 21 novembre 2026, la recette réelle a confirmé que le GET du compte omet `partnerTrackingID` (statut `REPORTED`), bien que le numéro de suivi corresponde. La documentation publique décrit le GET comme limité au propriétaire authentifié et la propriété n’est pas obligatoire dans le schéma. Le contrôle commun au worker et à la lecture manuelle accepte cette omission, garde la comparaison stricte du suivi et refuse toute référence interne fournie qui diffère. Régression : omission, identité contradictoire, autre colis et réponses invalides.

Les colis existants déjà arrêtés par l’ancien contrôle de référence passent, après une lecture authentifiée réussie, en `TRACKING_ONLY`. Ce mode continue les lectures périodiques avec bail et ne crée, ne confirme ni ne ramasse de colis, même si un statut distant régresse à `CREATED`. Les autres incidents et les colis déconnectés restent inchangés.
