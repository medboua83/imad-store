# Remise d'une boutique à un marchand

Modèle à compléter et signer par les parties habilitées. Ce document préparé ne vaut ni signature, ni cession automatique, ni validation juridique des conditions de vente.

## Identification et périmètre

| Champ | Valeur à renseigner |
| --- | --- |
| Fournisseur et représentant habilité | À compléter |
| Marchand et représentant habilité | À compléter |
| Identité juridique et coordonnées des parties | À compléter |
| Domaine remis et propriétaire du domaine | À compléter |
| Commit du code et empreinte de l'archive | À compléter |
| Date de remise et environnement | À compléter |
| Droit accordé : licence ou cession | À choisir explicitement |
| Installations, modification, redistribution, sous-licence | À décrire explicitement |
| Prix, taxes et modalités | À compléter |

Le code spécifique relève de `LICENSE` et `DISTRIBUTION_RIGHTS.md`. Les dépendances conservent leurs propres notices. Les marques, photos et contenus restent soumis aux autorisations correspondantes. Aucun compte, secret, client ou historique d'un autre marchand ne fait partie de la remise.

## Accès et responsabilités

Remettre les accès du domaine, de l'hébergement, de la boutique, du stockage et des services au propriétaire désigné par un canal privé. Ne pas inscrire les mots de passe dans ce document. Le marchand crée son compte et sa MFA ; l'opérateur technique conserve seulement les accès explicitement convenus. Révoquer les accès temporaires de recette.

Identifier le responsable des mises à jour, sauvegardes, clés de récupération, incidents, droits des collaborateurs, informations commerciales et démarches applicables à la protection des données. Décrire les connexions activées et celles désactivées ; l'absence de CRM est un fonctionnement autonome prévu, pas un défaut.

## Maintenance à convenir

Préciser la durée, les horaires et canaux d'assistance, les corrections incluses, les nouvelles fonctions exclues, les coûts de tiers et d'hébergement, le renouvellement des domaines/certificats, les règles d'intervention et de sortie du contrat. Toute garantie de disponibilité ou de reprise doit correspondre à l'infrastructure réellement testée.

Définir destination, fréquence, rétention, contrôle de restauration et récupération des clés. Inscrire la dernière restauration prouvée avec son périmètre. Une recette locale de base et fichiers ne prouve pas une bascule DNS ou une disponibilité 24 h/24. Un Mac éteint ou un disque absent ne reçoit aucune nouvelle copie.

## Procès-verbal de recette

Joindre une grille datée, avec résultat et preuve pour chaque ligne :

- installation neuve, domaine HTTPS, base/rôle/stockage séparés ;
- nom, logos, couleurs et contacts propres au marchand ;
- compte, MFA, récupération et permissions ;
- réception réelle des e-mails avec le SMTP du marchand ;
- produit, couleur, taille, panier et commande fictive sur environnement isolé ;
- reprise idempotente, annulation, stock et paiement ;
- caisse, session, ticket, retour et clôture avec données fictives ;
- configuration transporteur/CRM activée seulement sur périmètre autorisé ;
- sauvegarde chiffrée hors serveur et restauration isolée ;
- essai sur les appareils convenus, avec distinction entre vrai appareil et émulation ;
- formation, guide, notices et droits de redistribution.

Noter les réserves restantes, leur responsable et leur échéance. Un mot de passe absent, une information juridique inconnue ou une réception d'e-mail non constatée doit rester une réserve, jamais une validation fictive.

Signatures, noms, qualités et dates : à compléter par les parties.
