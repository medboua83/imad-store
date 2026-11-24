# Liste noire des numéros et validation Olivraison

Dans **Administration → Commandes → Liste noire des numéros**, les numéros liés à au moins une commande dont le statut actuel est `CANCELLED` sont regroupés automatiquement. La liste couvre toutes les commandes de cette installation, même les anciennes commandes conservées dans la corbeille. La recherche et la pagination sont effectuées sur le serveur, indépendamment des filtres et de la première page de commandes.

Les formats marocains complets `06…`, `6…`, `+212…` et `00212…` sont rapprochés avec la même règle que l’historique client. Les indicatifs internationaux restent distincts. Un numéro incomplet ou un contact principal invalide ne devient jamais une correspondance approximative. Une recherche par derniers chiffres filtre uniquement l’affichage ; elle ne modifie pas la règle de blocage, qui exige le numéro complet.

Une commande reste enregistrable et confirmable. Pour un numéro sur liste noire, la confirmation du client, de l’IA ou du CRM ne vaut pas autorisation d’envoi. La file Olivraison reste en `REVIEW_REQUIRED`, sans création de colis, jusqu’au bouton **Autoriser l’envoi à Olivraison** et à sa confirmation explicite. La permission `orders.write` est obligatoire et l’accord ne concerne qu’une commande. Les autres commandes du numéro restent retenues.

Le worker relit la liste avant chaque écriture externe : création, confirmation et ramassage. Une annulation concernant une autre commande est prise en compte même si cette autre commande a été créée plus tard que la commande en attente. Les numéros qui n’ont aucune annulation conservent leur parcours habituel. Les colis existants ne sont ni recréés ni annulés ; leur suivi en lecture reste disponible. Aucun ancien ordre n’est ajouté rétroactivement à la file.

La liste est calculée à partir de l’historique conservé, sans table supplémentaire, import ou suppression de données. Elle n’est pas une interdiction d’achat et n’est pas visible sur la vitrine. La consulter requiert `orders.read` et ne change ni les paiements ni le stock. Une erreur d’affichage ne désactive jamais la protection serveur. La date affichée dans la liste est celle de la création de la dernière commande annulée, pas une date d’annulation inventée.

Recette : tests PostgreSQL jetables pour les identités, la corbeille, la pagination et les permissions ; faux transporteur pour les annulations tardives, reprises et validations par commande ; tests navigateur français/arabe à 320, 390 et 1440 px. Aucun colis ni commande réelle n’est requis pour tester cette fonctionnalité.
