# Modèle de boutique par entreprise CRM

## Architecture retenue

Une entreprise utilise un déploiement indépendant, son domaine, sa base MongoDB avec des identifiants limités à cette base, ses secrets et son stockage d’images. Le code reste commun. Ce n’est pas une base partagée avec un filtre tenant envoyé par le navigateur. STORE_INSTANCE_ID et CRM_COMPANY_ID sont des UUID fournis exclusivement par l’environnement serveur.

Au premier démarrage, l’installation réserve l’identité dans une base vide et crée les index uniques indispensables (commandes idempotentes, file CRM, comptes, produits, etc.). Une autre identité, un profil manquant sur une base déjà attribuée ou une base copiée avec des données provoque un refus. Le contrôle couvre API, images, lectures serveur et tâches de synchronisation. Il ne remplace pas les droits MongoDB et les chemins de stockage distincts : l’opérateur doit les provisionner séparément.

Les installations historiques sans profil continuent de fonctionner avec leur configuration existante. Ne pas ajouter un nouveau profil à leur base remplie : la protection refuserait l’adoption. La migration d’une boutique existante vers un profil identifié doit être traitée séparément avec sauvegarde et rapprochement explicite.

## Identifiant visible dans l’administration

Après provisionnement d’un nouveau profil, Administration → Intégration CRM affiche l’identifiant de boutique en lecture seule, avec un bouton de copie, ainsi que l’entreprise CRM. Cet identifiant provient de l’installation ; il n’est ni une référence de commande ni un identifiant de source.

Dans le CRM disposant du module, utiliser Webhooks → Boutiques connectées pour préparer la source et la règle en pause, puis reporter les paramètres dans cette administration. La clé est dédiée, identique des deux côtés et ne se réaffiche pas. Les étapes manuelles ci-dessous restent utiles si le CRM ne possède pas encore ce module.

Une installation historique sans profil affiche cette absence d’identité explicitement. Utiliser le rattachement de sa source et de sa règle existantes dans le CRM ; ne pas générer arbitrairement un profil sur sa base remplie. La garde de séparation reste active.

## Créer et installer une boutique

La procédure maintenue est [le kit d’installation](STORE_INSTALLATION_KIT.md). `store:create` produit maintenant trois fichiers privés, dont une fiche `crm-registration.json` avec une clé de signature propre. Les travailleurs CRM sont en pause par défaut. Utiliser `store:run` avec le chemin explicite du profil pour vérifier, compiler, créer le premier administrateur et démarrer. `store:bundle` distribue uniquement le code du commit vérifié, sans profil privé ni données.

La fiche renseigne le formulaire **Webhooks → Boutiques connectées** ; ce module crée la source et la règle en pause. Ne plus créer une seconde règle manuellement. La personnalisation complète de la marque et le provisionnement de l’hébergement restent à effectuer pour chaque entreprise.

## Synchronisation et séparation

Le webhook sortant est chiffré. Une boutique ayant une file CRM ne peut pas la déplacer vers une autre source via l’administration. Les nouvelles clés d’idempotence incluent l’identité de boutique ; les anciennes installations conservent leur format de clé. L’unicité de la file et du checkout est imposée par MongoDB.

Le retour est signé, vérifie pipeline/étape et exige une commande existante déjà transmise. Le premier enregistrement fixe une limite historique persistante ; mise en pause, reprise et rotation de clé ne la réinitialisent pas. Un reçu et la transition sont atomiques : répétitions/concurrence ne créent pas de commande ou d’événement supplémentaire. Les commandes annulées sont protégées et les états avancés ne régressent pas. Aucun paiement, réservation de stock ni envoi marketing n’est déclenché par la confirmation.

Pour arrêter le retour, décocher la synchronisation et mettre la règle CRM en pause. Pour arrêter les envois, désactiver le webhook administrateur. Les anciens événements ne sont pas reconstruits. Préserver la limite de date de la file existante lors d’une mise à jour.

## Validation

36 tests isolés : compatibilité historique, callbacks concurrents, index uniques, profils et clés distincts, accès API/SSR/worker refusé pour autre entreprise, refus d’adoption d’une base copiée, chiffrement/absence de secret dans les réponses, mapping fixe et confirmation d’une commande unique avec paiement inchangé. Trois tests du serveur combiné passent. Build et lint passent. Formulaire vérifié dans un déploiement local vide avec compte et mapping fictifs : sauvegarde en pause, clé effacée du champ, scope verrouillé. Aucun nouvel accès CRM réel ni nouvelle entreprise de production n’a été créé pour ce lot.
