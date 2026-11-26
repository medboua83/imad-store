# Finaliser une boutique avec son propriétaire

Ce parcours complète le kit d’installation et le guide marchand. Une fonctionnalité testée, une configuration enregistrée, une réception réelle et une validation contractuelle sont des preuves différentes. Le bilan de préparation ne remplace pas les essais et décisions du propriétaire.

## 1. Rendre la récupération par e-mail opérationnelle

Dans **E-mails et SMTP**, le propriétaire renseigne l’adresse Gmail et son mot de passe d’application Google, puis active et enregistre l’envoi. Il saisit les secrets uniquement dans les formulaires de son propre compte et de sa boutique. Un nouveau mot de passe d’application se prépare dans le compte Google correspondant à l’expéditeur, pas dans le compte Google d’un autre opérateur.

Le bouton **Tester la connexion SMTP** vérifie la connexion, sans envoyer d’e-mail. Son succès ne valide pas la réception. Après l’enregistrement, le propriétaire et l’installateur vérifient, sur une boutique de démonstration isolée et avec une boîte de réception expressément choisie :

- une invitation destinée à un compte fictif de démonstration, avec les permissions minimales ;
- un lien de réinitialisation demandé pour ce même compte fictif ;
- le nom de la boutique, le domaine HTTPS du lien et la réception de chacun des deux messages ;
- l’expiration, le refus d’une seconde utilisation et le maintien de la MFA si elle était activée sur le compte de démonstration.

Ne pas réinitialiser le mot de passe du propriétaire de production pour prouver ce parcours. Ne pas donner accès à des données réelles à un compte de démonstration. Conserver seulement date, type de message, résultat et référence de recette, sans lien d’accès ni contenu privé du destinataire. Un e-mail accepté par SMTP n’est pas encore une réception constatée dans la boîte.

## 2. Protéger le compte personnel

Configurer la double authentification dans **Mon compte** avec l’application du propriétaire. Conserver les codes de secours avant de confirmer, puis se reconnecter avec un nouveau code après l’activation, qui ferme les sessions. Le [guide MFA](ADMIN_MFA.md) détaille le parcours et les limites. Ne pas scanner le QR du marchand avec le téléphone de l’installateur.

Chaque administrateur et caissier utilise un compte personnel. Confirmer les permissions à la remise ; ne pas accorder toutes les rubriques à un collaborateur pour simplifier un test.

## 3. Prouver la récupération hors du Mac de travail

Le propriétaire choisit un coffre ou un support de récupération indépendant. L’opérateur y dépose la clé de déchiffrement de sauvegarde et les éléments de récupération convenus par un canal privé, avec l’autorisation du propriétaire. Ne pas inscrire ces secrets dans ce guide, le procès-verbal, Git ou une capture.

Le propriétaire vérifie lui-même qu’il peut retrouver la clé depuis un autre appareil. La preuve de remise consigne seulement le nom du responsable, une référence non secrète du coffre et la date du contrôle. Des archives sur DATA avec une clé uniquement dans le Trousseau du Mac ne prouvent pas cette récupération indépendante.

Une restauration se teste sur une nouvelle base et un stockage isolé, sans application connectée aux intégrations réelles. Voir [sauvegardes et reprise](RECOVERY_OPERATIONS.md). Ne jamais essayer une archive non fiable sur le poste de travail.

## 4. Compléter les informations du marchand

L’identité visuelle et les coordonnées publiques se règlent dans **Paramètres → Identité de la boutique**. Le nom commercial ne remplace pas l’identité juridique. Dans **Contenu du site**, le marchand complète ses informations et les textes applicables à son activité, puis les valide lui-même. Les règles chiffrées de livraison et de retour restent reliées aux paramètres Commerce.

Le marchand confirme ses frais, délais, conditions de retour et confidentialité. L’installateur ne doit pas inventer un numéro d’immatriculation, une adresse, un délai, une autorisation ou une signature. Les décisions sur la licence, la redistribution et la maintenance se consignent dans le [procès-verbal de remise](CLIENT_HANDOVER.md), par les personnes habilitées.

## 5. Recette physique et incidents

Sur le téléphone et la tablette du marchand, noter modèle, système, navigateur et date. Vérifier le catalogue, les filtres, les couleurs et photos, les tailles, le panier et la visibilité des boutons. Les scénarios d’écriture (commande, vente, annulation et retour) se déroulent sur la démonstration isolée avec ses données fictives. Une simulation de viewport ne remplace pas ce contrôle physique.

Vérifier le suivi du site, la fraîcheur des sauvegardes et les alertes d’intégration. Une alerte transporteur s’examine avec les références existantes ; elle n’autorise ni nouvelle création de colis, ni modification de paiement pour rendre le bilan vert. Préciser si le suivi dépend d’un Mac allumé ou d’un service indépendant.

## 6. Clore la remise

Joindre le commit et l’empreinte du kit, les résultats de la [recette technique](RESALE_DELIVERY.md) et le procès-verbal signé. Chaque réserve reste ouverte avec son responsable et sa date de prochaine vérification. Ne déclarer une étape terminée que lorsque sa preuve existe ; aucun secret, état client ou sauvegarde de production ne fait partie du kit source remis à un autre marchand.
