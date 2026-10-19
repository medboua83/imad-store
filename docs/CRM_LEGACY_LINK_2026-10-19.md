# Identité de boutique et connexion historique

Les nouveaux profils possèdent un STORE_INSTANCE_ID créé par le provisionnement d’une base indépendante. Administration → Intégration CRM l’affiche en lecture seule, avec copie. Il ne s’agit ni d’une référence de commande ni de l’identifiant d’une source CRM. La clé dédiée reste masquée et chiffrée.

Quickydev est une installation historique sans cette identité. Ne pas ajouter arbitrairement les variables d’un nouveau profil : la protection contre l’adoption d’une base remplie doit continuer à refuser cette opération. Le module CRM reprend sa source et sa règle actuelles comme connexion historique, avec un filtre explicite sur la source. Aucun nouvel identifiant d’installation n’est inventé et aucun nouveau circuit d’envoi n’est créé.

Le site affiche cette distinction dans l’administration. Le format des futurs numéros de téléphone transmis au CRM devient international (+212 pour les numéros marocains locaux acceptés au checkout). Les coordonnées historiques, l’URL chiffrée, la clé de retour, les limites historiques, les commandes et les reçus ne sont pas réécrits.

Validation locale : 39 tests d’intégration réussis sur MongoDB jetable, compilation backend et lint frontend réussis. Une première exécution sans MongoDB a échoué avant les contrats ; elle n’est pas comptée comme réussite. La base de test est indépendante de toute base active. Compilation et publication finales sont consignées séparément.
