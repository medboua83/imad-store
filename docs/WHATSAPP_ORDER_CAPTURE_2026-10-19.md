# Premier contact WhatsApp après commande — déployé et testé

La connexion des commandes et le retour des statuts restent indépendants du premier contact IA. Une commande déjà transmise avec `aiConsent: false` n’est pas réécrite ou rejouée pour autoriser l’IA.

## Nouvelle demande client

Quand l’intégration boutique est activée avec une signature entrante enregistrée, le checkout propose une demande facultative d’assistance automatisée WhatsApp, distincte des publicités et des réglages CRM. Elle est décochée initialement. Le texte indique le motif (confirmer cette commande et ses détails), le caractère automatisé, le recours à l’équipe et la possibilité d’arrêter. Le format international doit être saisi explicitement ; un numéro local reste accepté pour une commande sans cette assistance.

Le serveur valide la version exacte `order-whatsapp-v1-2026-10-19`, le booléen et le téléphone international. Il enregistre le choix, la version et la date avec la commande. Le même accord est capturé atomiquement dans la file ; une reprise ne le remplace pas par l’état actuel d’un formulaire ou du catalogue. L’idempotence empêche de réutiliser la même clé pour changer ce choix.

Les champs MongoDB sont optionnels pour conserver la compatibilité historique. Générer le client Prisma lors du build ; ne pas exécuter `prisma db push` sur une base active. Aucune migration ni réécriture de données existantes n’est nécessaire pour ces champs optionnels.

## Signature d’entrée CRM

Administration → Intégration CRM → **Signature des envois vers le CRM** accepte la clé dédiée générée dans la source CRM. Elle est chiffrée avec la clé serveur existante ; les réponses et l’interface n’affichent que sa présence. Champ vide conserve la clé ; effacement explicite. Changer de destination efface l’ancienne signature sauf remplacement explicite. Cette clé est distincte de celle du retour **CRM → boutique**.

Pour les nouvelles captures, le corps JSON signé contient `external_id` stable, `submission_status: completed`, le booléen réel `ai_service_consent` et la version de notice si l’accord est valable. L’en-tête `x-deskcomm-signature` est HMAC-SHA256 du corps exact. Le marqueur interne de téléphone explicite n’est jamais fabriqué par la boutique : le CRM le déduit de l’entrée reçue.

Les événements existants sans marqueur `captureVersion` conservent leur formulaire d’origine et n’acquièrent pas de nouveaux champs d’autorisation ou référence. Si la signature est installée, ce corps historique peut être signé sans modifier son protocole. Aucun événement SENT n’est repris et la limite historique du worker reste inchangée. Les nouvelles captures encore non signées disposent de leur référence stable, mais ne déclarent pas d’accord IA dans l’ancien formulaire.

## Bascule coordonnée

1. Vérifier sauvegardes, état des files et version testée ; conserver la limite historique.
2. Mettre la transmission boutique en pause pendant le raccordement de la signature. Ne pas effacer l’URL ni changer de source.
3. Générer la signature de la source CRM et la reporter dans l’administration boutique, sans l’afficher dans un rapport ou Git.
4. Autoriser l’IA de cette source seulement après signature ; réserver le canal à l’agent choisi, sans routeur actif. Les autres configurations d’agents restent conservées.
5. Préparer sa règle de premier contact en pause, puis activer après vérification des prérequis. Réactiver les envois boutique sans reculer la date limite.
6. Tester uniquement avec un nouveau numéro et une commande fictive autorisés : reçu CRM, accord exact, premier message réellement reçu, réponse traitée par le même agent, absence de doublon. Le paiement et la validation humaine de livraison restent séparés.

Si le service IA n’est pas prêt, garder sa règle en pause. La réception de commande et son retour de confirmation peuvent continuer. L’option de checkout indique seulement une demande d’assistance ; le serveur CRM conserve ses contrôles de canal, d’agent, d’horaires, de budget, de contact et d’éligibilité. Aucun garde-fou n’est contourné par le site.

## Recette locale

40 tests MongoDB jetables, 6 tests du kit et 50 tests CRM ciblés ; compilations et typage complets, lint. Contrôles négatifs détectant une version de notice ignorée et des publications historiques recomptées, puis code restauré. Dans Chrome sur base indépendante : demande décochée, refus d’un téléphone local pour WhatsApp, commande fictive enregistrée avec accord/version/date, paiement en attente ; signature fictive sauvegardée et champ effacé. Workers désactivés et destinataire `.invalid`, aucun envoi externe. La recette réelle et les conditions de mise en service sont décrites ci-dessous.

## Premier contact WhatsApp — déployé et vérifié le 19 octobre 2026

PR boutique #29 fusionnée (`77b1163`) et correctif CRM privé #5 fusionné (`6ab8bc664`, image testée `saas-ad41d981d`). Les trois services CRM sont sains ; configuration, identités et retour des confirmations conservés. Signature HMAC dédiée raccordée à la source existante, transmission boutique réactivée et règle existante de premier contact activée. Routeur partagé inactif ; agent conseil archivé avec versions conservées ; agent de confirmation seul sur le numéro réservé.

Recette réelle autorisée : deux commandes distinctes fictives marquées NE PAS EXPÉDIER. Une première tentative a respecté la prise en charge humaine existante. Après restitution autorisée du contact, la tentative de la seconde commande a été reprise via le moteur métier, avec l’événement original et tous les contrôles conservés. Résultat : un prospect par référence, un seul message initial pour la seconde commande, statut WhatsApp `delivered`. Les réponses du propriétaire sont traitées par l’agent de confirmation ; les traces attribuées à un agent ne montrent que cet agent. Aucune troisième commande, paiement ou création de colis. Les anciennes commandes réelles ne sont pas rejouées.

Après le test aller-retour et accord explicite du propriétaire, le canal a été ouvert aux clients ; l’interface affiche « L’IA ouverte au public ». La liste de test ne limite plus les réponses entrantes. Le premier contact sur commande exige toujours la demande d’assistance reçue dans la capture signée. Les demandes d’assistance explicites, les oppositions, le traitement humain, les budgets et la validation humaine avant livraison restent appliqués. Les échecs précédents restent visibles dans l’activité ; ils ne constituent pas des prospects supplémentaires.
