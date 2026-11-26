# Clôture administrative d’un incident transporteur

Dans Commandes → fiche commande → Suivi Olivraison, le bouton **Clôturer l’incident sans mouvement de stock** demande un motif de 10 à 1 000 caractères. Les droits de lecture **et** de modification des commandes sont requis. L’action enregistre le motif, l’utilisateur et la date dans un historique privé, consultable par les comptes autorisés à lire les commandes. Les anciennes clôtures restent accessibles par pages de vingt.

Cette clôture est une prise en compte administrative de l’incident observé. Elle ne confirme pas un retour physique, une livraison ou un règlement. Elle ne modifie aucun statut de commande, paiement, montant, quantité, réservation, identité de colis, ramassage ou configuration. Aucun appel au transporteur ni envoi CRM n’est exécuté. Ne l’utiliser qu’après un contrôle réel et documenté ; une régularisation du stock éventuelle appartient à une action distincte.

L’alerte clôturée disparaît des incidents à traiter, du filtre « À surveiller » et du bilan, mais le statut transporteur et le diagnostic restent lisibles. Le suivi des incidents non terminaux continue uniquement par lecture du colis existant. Un nouveau statut, une nouvelle erreur, un changement de colis ou d’état de traitement crée une nouvelle version d’incident et réouvre l’alerte. Un cycle de statuts qui revient à une ancienne valeur ne réutilise pas une ancienne clôture. Une simple actualisation des dates de suivi ou des verrous ne crée pas de nouvel incident.

## Intégrité et concurrence

La nouvelle table `carrier_incident_closures` possède une contrainte unique sur commande/empreinte et des contraintes sur le motif et l’empreinte. Le motif et l’identité du premier auteur ne sont pas remplacés lors d’une répétition. Une transaction sérialisable et le verrou du colis coordonnent la clôture avec les lectures et reprises existantes. Une vue périmée ou un suivi en cours reçoit une réponse de conflit plutôt que de clôturer une autre situation.

Le compteur `incidentVersion`, géré par un déclencheur PostgreSQL, ne change que si les champs définissant l’incident changent. La clôture ne met pas à jour le colis ni ce compteur. Le déclencheur couvre également les anciens exécutables pendant un retour à la version précédente.

Les motifs ne sont pas ajoutés aux événements renvoyés par les parcours publics. Les réglages de livraison exposent seulement l’état de clôture ; les motifs et auteurs se lisent dans la fiche commande avec les droits correspondants. Aucun secret n’est attendu dans un motif.

## Publication

Appliquer la migration additive `20261126180000_carrier_incident_closures` après sauvegarde et répétition sur une copie privée sans travailleurs externes. Elle ajoute une table vide, un compteur au suivi, une fonction et un déclencheur ; elle ne met à jour aucune donnée commerciale. Le compte applicatif doit lire et insérer les clôtures ; il n’a besoin ni de les modifier ni de les supprimer. Vérifier les empreintes des paiements, montants, réservations, stocks et identités de colis avant et après publication. Un retour au code précédent conserve les nouvelles structures et leur historique ; ne pas les supprimer.

Les tests de publication doivent utiliser des données fictives et des bases isolées. Ne pas clôturer une véritable alerte avec un motif inventé pour démontrer le bouton.
