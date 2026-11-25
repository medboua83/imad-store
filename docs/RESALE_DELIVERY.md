# Préparation, recette et surveillance avant remise

## Ce que le logiciel fournit

Une boutique indépendante par installation, un mode autonome sans CRM, une identité personnalisable, un catalogue vide, des variantes et photos liées aux couleurs, une caisse et ses registres, des comptes à permissions, une MFA optionnelle par compte, une récupération SMTP et des outils de sauvegarde/restauration. Aucune image téléversée, donnée de client ou clé IMAD n'est exportée par le kit source.

Le premier compte n'a pas de mot de passe universel. Sa création est exclusive et transactionnelle ; elle initialise le nom choisi, des réseaux sociaux vides, aucun Pixel et, en mode autonome, la confirmation sur le site. Une base déjà attribuée ou contenant des données, y compris des reçus de caisse seuls, ne peut pas être adoptée comme une nouvelle boutique.

## Grille de recette technique

| Vérification | Preuve attendue |
| --- | --- |
| Kit neuf | Extraction, `npm ci`, paquets locaux présents, compilation sur la cible |
| Séparation | Base, rôle, profils et stockage propres ; refus d'une base copiée |
| Mode autonome | Aucun compte CRM requis, activation CRM refusée, commande possible sans CRM |
| Propriétaire | Compte unique, cookies protégés, pas de secret en stockage navigateur |
| Autorisations | Collaborateur refusé hors de ses rubriques |
| Catalogue | Image/couleur/taille, stock, brouillon, publication et reprise après erreur |
| Commande | Prix serveur, une commande malgré une répétition, annulation sans changement du paiement |
| Caisse | Session propre, vente dédupliquée, ticket, retour revendable et clôture |
| Sauvegarde | Chiffrement, copie hors hôte, clés séparées, restauration sur nouvelle base |
| Reprise d'accès | MFA, secours et SMTP, avec réception réelle distinguée d'une simulation |
| Affichage | Français/arabe, téléphone/tablette/ordinateur, clavier et erreurs lisibles |

Les scénarios d'écriture utilisent des fixtures ou une base jetable. Un essai de transporteur externe ou de paiement doit être expressément autorisé ; ne pas envoyer un colis réel pour démontrer l'interface.

## Bilan dans les réglages

`GET /api/settings/readiness` exige une session actuelle et `settings.manage`, répond en `private, no-store` et ne modifie rien. Le résultat vérifie coordonnées, textes publiés et validés, règles de livraison/retour, configuration SMTP déchiffrable, MFA du seul compte courant, reçu de sauvegarde et incidents. Il ne retourne aucun secret ou donnée de client. Une configuration SMTP ne prouve pas que le destinataire a reçu un e-mail.

Les textes juridiques restent à valider par le marchand. Au Maroc, consulter les sources officielles : [protection du consommateur](https://www.mcinet.gov.ma/fr/content/protection-consommateur/droits-garantis-aux-consommateurs), [loi 31-08](https://dgssi.gov.ma/sites/default/files/legislative/brochure/2023-07/loi%2031-08.pdf) et [CNDP](https://www.cndp.ma/textes-et-lois/). Identifier le vendeur, ses coordonnées, les conditions applicables, les délais et frais, les destinataires et finalités des données ainsi que les démarches applicables à son activité. Ne pas inventer un numéro d'immatriculation, un délai contractuel ou une déclaration CNDP.

## Surveillance sans relance automatique

`GET /health` vérifie que l'application et sa garde d'installation répondent. `GET /api/operations/health` expose seulement `status`, `backupFresh`, `hasFailedSends` et l'heure de contrôle ; pas de comptes, volumes, clients, clés ou chemins privés. Un état `attention` ne signifie pas que la boutique est inaccessible : il demande un contrôle des sauvegardes ou envois. Le bilan privé permet d'identifier les rubriques concernées, sans refaire un envoi.

Pour déclarer la fraîcheur d'une copie hors serveur, l'opérateur configure `IMAD_OFFSITE_STATUS_FILE` sur un fichier ordinaire privé, hors du code et des images, non modifiable par le groupe ou les autres utilisateurs. Le reçu contient uniquement :

```json
{
  "completedAt": "2026-11-25T00:00:00.000Z",
  "verified": true,
  "encryptedSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "tables": 34,
  "photos": 0
}
```

Ces valeurs sont un exemple de format, pas une attestation à copier. Écrire le reçu seulement après transfert chiffré et restauration réussie, par un opérateur ou un exporteur authentifié. Un lien symbolique, fichier public en écriture, JSON inattendu, date future ou reçu de plus de 36 heures ne passe pas le contrôle. L'absence d'un reçu ne déclenche aucune restauration et ne modifie aucune commande.

Configurer une surveillance indépendante pour le domaine, les réponses, les sauvegardes anciennes et les échecs d'envoi. Les alertes doivent distinguer une panne du site d'un incident d'intégration. Conserver l'état précédent pour ne pas envoyer une notification identique à chaque contrôle. Documenter les dépendances du dispositif de surveillance à un Mac ou à une application locale ; un tel dispositif ne vaut pas une surveillance externe permanente.

## Remise

Livrer le commit vérifié, l'empreinte du kit, les guides, les notices, les responsabilités et le [procès-verbal](CLIENT_HANDOVER.md). Indiquer explicitement les étapes non attestées : secret SMTP absent, test de réception non effectué, clés non déposées dans un coffre indépendant, signature ou identité juridique manquante, appareil réel indisponible. Ne pas annoncer ces réserves comme terminées.
