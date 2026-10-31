# Règles commerciales actuelles — 31 octobre 2026

Cette page est la référence de maintenance. Les notes datées de PROJECT_MEMORY gardent les anciennes décisions ; les interprétations incompatibles sont remplacées par les règles ci-dessous. Le code partagé et les tests doivent rester cohérents avec elles.

## Prix et promotions

Le marchand saisit chaque quantité et son prix total. Les nouveaux champs restent vides. Une offre explicitement configurée pour la quantité exacte est prioritaire, même si un assemblage de lots serait moins cher. Sinon, répéter le plus petit lot configuré et facturer les pièces restantes au prix original. Sans offre, appliquer prix original × quantité. Les variantes d’un même produit sont regroupées pour ce calcul ; les produits différents ne le sont pas.

| Prix original 230 MAD, lot de 2 à 400 MAD | Total produits |
| --- | --- |
| 1 pièce | 230 MAD |
| 2 pièces | 400 MAD |
| 3 pièces | 630 MAD |
| 4 pièces | 800 MAD |
| 5 pièces | 1 030 MAD |
| 3 pièces avec offre exacte à 650 MAD | 650 MAD |

Les prix barrés n’ajoutent pas une seconde réduction. Calcul en centimes, répartition exacte sur les lignes de commande ; les anciens instantanés commande/outbox restent inchangés. Tests : quantity-pricing, cart et quantity-offers UI.

## Livraison et retours

Frais calculés sur le montant produits après promotions. Livraison gratuite si au moins une ligne éligible est présente, ou si le seuil enregistré est atteint. Frais et seuil proviennent des réglages de chaque installation, jamais d’une constante d’interface.

Pour quickydev.com seulement, valeurs confirmées par le marchand : livraison sous 3 jours maximum ; demande de retour dans les 3 jours suivant réception. La boutique prend les frais de retour à sa charge si le retour est confirmé pendant l’essayage à la livraison. Après paiement et départ du livreur, frais de retour à la charge du client. Réglage DELIVERY_TRY_ON. Les autres installations commencent sans délai ni payeur de retour préremplis.

État exigé du produit, adresse de retour et traitement du montant : à confirmer avec le marchand, sans les inventer. L’affichage des conditions ne déclenche ni remboursement ni colis.

## Fiabilité du parcours

Les montants affichés ne remplacent pas les contrôles serveur. Le checkout revalide catalogue, frais et stock ; une panne bloque la soumission et propose de réessayer. La confirmation directe et l’assistance IA suivent les réglages administratifs existants. Pas de nouvelle case IA au checkout. Les envois CRM, confirmations et colis conservent leurs signatures, règles d’activation et protections contre les doublons.

Un panier endommagé conserve ses lignes valides et affiche un avertissement. Un stockage bloqué laisse la session de panier utilisable. La recette utilise des produits et services fictifs ; aucune vraie commande, sortie WhatsApp, reprise CRM ou action transporteur sans autorisation spécifique. Le suivi public de commande reste hors périmètre, à la demande du marchand.

## Présentation et partage

Photos originales conservées ; cadrage sans recadrage destructif, bordures dorées et aides lisibles. Chaque produit garde sa propre image, son nom et sa description pour Open Graph/Twitter. L’accueil et le catalogue utilisent une carte de marque séparée. Les URL de partage suivent le domaine de l’installation.

Les mesures HTTP ou le poids des ressources ne sont pas des Core Web Vitals ni un score Lighthouse. Ne pas annoncer de gain de conversion ou de performance sans mesure adaptée.
