# Modèle de boutique par entreprise CRM

## Architecture retenue

Une entreprise utilise un déploiement indépendant, son domaine, sa base MongoDB avec des identifiants limités à cette base, ses secrets et son stockage d’images. Le code reste commun. Ce n’est pas une base partagée avec un filtre tenant envoyé par le navigateur. STORE_INSTANCE_ID et CRM_COMPANY_ID sont des UUID fournis exclusivement par l’environnement serveur.

Au premier démarrage, l’installation réserve l’identité dans une base vide et crée les index uniques indispensables (commandes idempotentes, file CRM, comptes, produits, etc.). Une autre identité, un profil manquant sur une base déjà attribuée ou une base copiée avec des données provoque un refus. Le contrôle couvre API, images, lectures serveur et tâches de synchronisation. Il ne remplace pas les droits MongoDB et les chemins de stockage distincts : l’opérateur doit les provisionner séparément.

Les installations historiques sans profil continuent de fonctionner avec leur configuration existante. Ne pas ajouter un nouveau profil à leur base remplie : la protection refuserait l’adoption. La migration d’une boutique existante vers un profil identifié doit être traitée séparément avec sauvegarde et rapprochement explicite.

## Identifiant visible dans l’administration

Après provisionnement d’un nouveau profil, Administration → Intégration CRM affiche l’identifiant de boutique en lecture seule, avec un bouton de copie, ainsi que l’entreprise CRM. Cet identifiant provient de l’installation ; il n’est ni une référence de commande ni un identifiant de source.

Dans le CRM disposant du module, utiliser Webhooks → Boutiques connectées pour préparer la source et la règle en pause, puis reporter les paramètres dans cette administration. La clé est dédiée, identique des deux côtés et ne se réaffiche pas. Les étapes manuelles ci-dessous restent utiles si le CRM ne possède pas encore ce module.

Une installation historique sans profil affiche cette absence d’identité explicitement. Utiliser le rattachement de sa source et de sa règle existantes dans le CRM ; ne pas générer arbitrairement un profil sur sa base remplie. La garde de séparation reste active.

## Créer une boutique

Depuis un checkout propre du dépôt :

```sh
npm ci
npm run store:create -- UUID_ENTREPRISE_CRM "Nom de la boutique" https://boutique.example /chemin/vers/nouveau-profil
```

Le dossier doit être neuf. Il contient un `store.env` privé et `INSTALLATION.txt`. Aucun environnement existant, produit, client, commande, compte, clé ou photo privée n’est lu ou copié. Chaque appel génère une identité, un nom de base et des clés JWT/chiffrement distincts. Ne jamais committer ces fichiers. Charger les valeurs avec l’hébergement ou dotenv ; ne pas exécuter le fichier comme un script shell.

1. Créer la base MongoDB et son utilisateur limité, le domaine et le stockage persistant. Adapter DATABASE_URL et UPLOAD_DIR du nouveau profil. Installer toutes les variables sur un nouveau déploiement (entrée server.js, mode combined).
2. Fournir temporairement BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD (16 caractères minimum), puis exécuter `npm run store:admin` dans un contexte ayant chargé le profil. Ce programme réserve l’installation et crée un premier administrateur sans publier ses identifiants ; il refuse de réinitialiser un compte existant. Retirer les variables bootstrap après usage.
3. Construire/démarrer la boutique ; personnaliser pages, catalogue et informations commerciales avec l’administration. Adapter également le nom, le logo et les couleurs du modèle avant publication : STORE_DISPLAY_NAME nomme l’origine CRM et ne remplace pas toutes les marques visuelles. Le générateur prépare l’installation, pas une marque blanche complète, les informations commerciales ou l’hébergement de l’entreprise.
4. Créer une source webhook dans la bonne entreprise CRM et la coller dans Administration > Intégration CRM. Les champs de référence doivent conserver l’identifiant complet `pedido_id`. Le nom d’origine est STORE_DISPLAY_NAME ; boutique_id et entreprise_id accompagnent les formulaires comme informations de rapprochement, jamais comme preuve d’autorisation.
5. Préparer une clé de signature dédiée de 64 caractères hexadécimaux. Dans « Connexion de cette entreprise », enregistrer le pipeline, son étape confirmée et le champ de référence, d’abord en pause. La clé reste chiffrée côté serveur et n’est jamais renvoyée au navigateur. Pipeline et champ sont fixes après enregistrement ; une modification demande une autre installation. Une clé peut être remplacée et l’étape ajustée avec coordination côté CRM.
6. Dans le CRM, créer une règle `lead.stage_changed` avec conditions sur `event.to_stage_id` ET `lead.pipeline_id`, action webhook vers `https://boutique.example/api/integrations/deskcomm/status-callback`, même clé. Activer les deux côtés après vérification. La création de l’entreprise, de sa source et de sa règle CRM reste une opération dans le CRM ; ce dépôt ne les crée pas automatiquement.
7. Avec accord du propriétaire, tester une commande fictive et sa confirmation. Vérifier une commande, un prospect et une seule transition. La base des nouvelles boutiques doit rester vide de données d’autres entreprises.

## Synchronisation et séparation

Le webhook sortant est chiffré. Une boutique ayant une file CRM ne peut pas la déplacer vers une autre source via l’administration. Les nouvelles clés d’idempotence incluent l’identité de boutique ; les anciennes installations conservent leur format de clé. L’unicité de la file et du checkout est imposée par MongoDB.

Le retour est signé, vérifie pipeline/étape et exige une commande existante déjà transmise. Le premier enregistrement fixe une limite historique persistante ; mise en pause, reprise et rotation de clé ne la réinitialisent pas. Un reçu et la transition sont atomiques : répétitions/concurrence ne créent pas de commande ou d’événement supplémentaire. Les commandes annulées sont protégées et les états avancés ne régressent pas. Aucun paiement, réservation de stock ni envoi marketing n’est déclenché par la confirmation.

Pour arrêter le retour, décocher la synchronisation et mettre la règle CRM en pause. Pour arrêter les envois, désactiver le webhook administrateur. Les anciens événements ne sont pas reconstruits. Préserver la limite de date de la file existante lors d’une mise à jour.

## Validation

36 tests isolés : compatibilité historique, callbacks concurrents, index uniques, profils et clés distincts, accès API/SSR/worker refusé pour autre entreprise, refus d’adoption d’une base copiée, chiffrement/absence de secret dans les réponses, mapping fixe et confirmation d’une commande unique avec paiement inchangé. Trois tests du serveur combiné passent. Build et lint passent. Formulaire vérifié dans un déploiement local vide avec compte et mapping fictifs : sauvegarde en pause, clé effacée du champ, scope verrouillé. Aucun nouvel accès CRM réel ni nouvelle entreprise de production n’a été créé pour ce lot.
