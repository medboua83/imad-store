# Corbeille des commandes

## Corbeille des commandes — candidat du 21 octobre 2026

Suppression réversible des seules commandes annulées sans réservation de stock active : action individuelle et groupée sur la sélection affichée, corbeille paginée et restauration. Le serveur exclut les documents marqués de la liste administrative et de ses compteurs ; les anciens documents sans champ deletedAt restent visibles. Opération atomique, droits administrateur et journal des déplacements/restaurations. Les commandes, articles, paiements, stocks, fichiers CRM et reçus restent conservés. Aucune nouvelle transmission ni rejeu CRM. Le suivi invité conserve le statut annulé.

Génération Prisma uniquement ; aucun db push ni index modifié. Pour un test encore actif, utiliser d’abord l’annulation existante avec ses contrôles de réservation, puis la corbeille. La sélection groupée ne devine jamais les commandes de test à partir d’un nom ou numéro. Le retrait ne supprime pas les prospects déjà transmis au CRM ni les données des services externes.

Compilation backend, lint et compilation/typecheck frontend réussis. Un scénario d’intégration couvre les accès, lots mixtes refusés, anciennes commandes sans champ, répétition, exclusion/restauration, audit et préservation stock/outbox. MongoDB local est indisponible dans cet environnement (démarrage refusé) : validation de ce scénario confiée à la CI isolée avant publication. Aucun nettoyage en production effectué à ce stade.

