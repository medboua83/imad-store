# Media Buyer — dépenses Meta et commandes réellement livrées

## Accès et connexion

Ouvrir **Administration → Media Buyer** (`/admin?tab=media`). Les administrateurs disposent du module ; les collaborateurs doivent recevoir explicitement la permission **Consulter Media Buyer et les dépenses publicitaires** (`media.read`). Cette permission ne permet ni connexion, ni modification de cible, ni synchronisation. Elle donne accès aux chiffres agrégés, sans coordonnées client.

Dans **Réglages Media Buyer → Connexion au compte Meta Ads**, un administrateur renseigne l’identifiant du **compte publicitaire** (avec ou sans `act_`) et un jeton Meta disposant de `ads_read` ainsi que de l’accès à ce compte. Un identifiant de Pixel n’est pas un compte publicitaire. Utiliser une application Meta autorisée pour ce cas d’usage ; selon la propriété des comptes et le mode de l’application, la revue Meta et un accès avancé peuvent être nécessaires. Ne jamais demander le mot de passe Facebook du marchand. La création du jeton se fait dans Meta, pas dans le chat.

Confirmer avec le mot de passe actuel de l’administration et, si activée, la double authentification ou un code de secours. Le serveur vérifie l’identité, la devise, le fuseau et l’accès Insights avant de remplacer la connexion. Un jeton vide ne conserve un ancien jeton que pour le même compte. Le changement de compte ne transfère ni ses dépenses, ni sa devise à un autre compte.

Le jeton est chiffré avec la clé serveur existante `DESKCOMM_ENCRYPTION_KEY`, dans une enveloppe liée à l’identifiant du compte. Il n’apparaît jamais dans les réponses, URL, journaux ou stockage navigateur. Les champs sensibles sont effacés après chaque tentative, y compris en cas de réponse perdue ; aucune écriture n’est réessayée automatiquement. Le navigateur n’obtient qu’un état connecté/non connecté. La déconnexion supprime le jeton et invalide les synchronisations en cours ; les chiffres conservés restent consultables.

## Synchroniser les dépenses

Choisir une période de **1 à 90 jours**, cliquer sur **Afficher**, puis **Synchroniser les dépenses de cette période**. La synchronisation est déclenchée à la demande ; ce module n’installe aucun planificateur ni automatisme de budget. Réactualiser les jours récents avant de décider. Le compte, sa devise, son fuseau, la dernière synchronisation et les erreurs restent visibles.

L’intégration appelle exclusivement l’API officielle **Graph/Marketing v26.0**, en lecture `GET`, sur `act_<id>` et `act_<id>/insights`. Les dépenses sont demandées au niveau `ad`, avec `time_increment=1`, `time_range` explicite, sans conversions Meta ni estimations de chiffre d’affaires. Les fenêtres sont découpées en 31 jours et les réponses paginées. La pagination utilise seulement un curseur validé sur l’origine Graph fixe, jamais l’URL `paging.next` renvoyée par un service. Délais, volumes, montants, dates, compte, devise et cohérence des identifiants sont bornés.

La clé unique est **compte + publicité + jour**. Toutes les pages doivent être valides avant une transaction atomique remplaçant la fenêtre du compte. Une seconde synchronisation remplace les chiffres, elle ne les additionne pas. Les jours sans dépense sont marqués comme vérifiés et les anciennes lignes absentes d’une nouvelle réponse complète sont retirées. Une erreur conserve les chiffres antérieurs et leur date de réussite. Un verrou temporaire et une révision empêchent les publications concurrentes ou une écriture après déconnexion/changement de compte.

Des plafonds prudents protègent la première version : 1 000 publicités avec dépenses, 10 000 lignes et 100 pages par tranche lors d’un import ; 10 000 publicités conservées dans un rapport. Si le compte dépasse ces limites, raccourcir la période et prévoir un traitement asynchrone dédié. Le module n’interprète jamais une réponse partielle comme un zéro.

## Paramètres des publicités et consentement

Dans **Meta Ads Manager → Publicité → Suivi → Paramètres de l’URL**, coller le modèle proposé dans le module, sans `?` initial :

```
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

Les identifiants restent des chaînes, pas des nombres JavaScript. Les clés de rapprochement sont **campaign_id + adset_id + ad_id**, dans le compte connecté, après vérification de la hiérarchie connue dans les dépenses. Les noms affichés peuvent évoluer sans couper l’historique. Les paramètres sont déclaratifs et ne prouvent ni un clic facturé, ni la causalité d’une commande.

Règle : **dernière visite balisée consentie dans les 30 jours**, même navigateur/origine. Une visite directe conserve la source sans prolonger sa durée. Un nouveau lien remplace le jeu complet des champs, sans fusion de campagnes. Le suivi ne conditionne jamais l’achat. Pas de capture avant consentement, ni pour DNT/GPC, administration, HTTP ou test statistique. Le retrait bloque la transmission, efface le lien local et se propage entre les onglets. Aucun rapprochement rétroactif ou entre appareils. Voir [attribution et rétention](CAMPAIGN_ATTRIBUTION.md).

Les anciennes commandes, refus, données expirées, liens incomplets ou identifiants non rapprochés restent **Source inconnue**, sans attribution « organique » inventée. Le total inconnu couvre la période entière, hors filtres publicitaires. Un sous-total signale les commandes portant un identifiant publicitaire non rapproché. Une publicité sans dépense importée ni dimension déjà connue ne peut pas être rapprochée de façon fiable.

L’attribution de commande est supprimée **90 jours après la commande**. Les dépenses agrégées restent conservées. Les cohortes plus anciennes deviennent donc incomplètes et ne doivent pas servir à une décision sans tenir compte de cette limite. Le rapport n’est pas l’attribution officielle de Meta ; ses chiffres peuvent différer de ceux d’Ads Manager.

## Cohortes, statuts et calculs

Les dates suivent le fuseau **du compte publicitaire**, pour les dépenses comme pour la création de commande. Le serveur utilise le même calendrier ICU que les dates affichées, indépendamment du fuseau de session PostgreSQL. Les filtres campagne/ensemble/publicité utilisent les identifiants. Les commandes supprimées ou placées dans la corbeille restent dans les résultats afin de ne pas améliorer artificiellement une campagne.

**Coût publicitaire par commande livrée = dépenses de la période ÷ commandes attribuées créées pendant cette période et livrées à ce jour.** Ce n’est ni le coût des seules livraisons réalisées pendant la période, ni le CPA Purchase affiché par Meta. Les dépenses manquantes ou un dénominateur nul donnent `—`. Un zéro n’est affiché que pour une période complètement vérifiée.

Le rapport réutilise les statuts de la commande et du suivi Olivraison, sans les modifier :

| Mesure | Règle |
| --- | --- |
| Attribuées | Commandes de la cohorte dont les trois identifiants sont valides et rapprochés du compte. |
| Confirmées | Confirmation SITE, `confirmedAt`, état confirmé/expédié/livré, ou événement de transition existant admin/CRM/sheets/Olivraison. C’est une étape atteinte, pas un état exclusif. |
| Livrées | Suivi `DELIVERED`, ou commande `DELIVERED` sans contradiction du suivi. |
| Retournées | Suivi `RETURNED`, prioritaire sur une ancienne livraison. Une commande livrée puis retournée sort des livrées et augmente les retournées ; le coût net est recalculé. |
| Retour en cours | `RETURN_IN_TRANSIT` ou `RETURNING` : exclu des livrées dès que le retour est signalé. |
| Annulées | Commande `CANCELLED` ou suivi `CANCELED`, `CANCELLED`, `CUSTOMER_CANCELED`, `DELETED`, hors cas de retour/livraison contradictoire. |
| En livraison | Commande `SHIPPED` ou codes d’acheminement existants du transporteur. |
| En attente | Autres commandes, dont confirmations en attente de création/ramassage. |
| À vérifier | Code transporteur inconnu, `ARCHIVED` sans issue physique exploitable ou contradiction livré/annulé. Un archivage seul ne prouve ni livraison, ni retour ; il ne rétablit jamais une livraison après un retour observé. |

Les issues actuelles sont exclusives. La colonne confirmée ne doit pas être additionnée aux autres. Une synchronisation transporteur ultérieure fait évoluer les chiffres lors de la prochaine lecture du rapport. L’intégration CRM peut être absente ; aucun nouveau CRM n’est requis. Le module ne crée aucune commande, aucun colis, aucun événement Pixel, et ne déclenche aucun mouvement de stock ou paiement.

**Encaissement : non affiché.** Le statut `DELIVERED` et un Purchase COD ne prouvent pas un reversement transporteur. L’application ne dispose pas ici d’un registre fiable de rapprochement des versements. Aucune somme des livrées n’est présentée comme encaissée.

## Recommandations explicables

Définir le coût cible en **MAD**, sans conversion implicite. La cible affichée avec les recommandations vient de la même photographie de données que leur calcul, même si un autre administrateur a changé les réglages depuis l’ouverture de l’écran. Les coûts d’un compte non MAD restent dans sa devise ; une conversion fiable manque alors pour comparer au coût cible et aucune recommandation de hausse n’est donnée.

Les cartes concernent la campagne entière sur la période (et le filtre campagne), indépendamment des filtres ensemble/publicité. Elles exposent dépenses, coût par livrée, commandes attribuées/livrées/annulées/retournées, commandes encore non résolues et ancienneté. Les règles suivantes sont des garde-fous heuristiques, pas une garantie de performance :

- Connexion, période entièrement synchronisée et chiffres de moins de 48 h sans erreur sont requis ; sinon, compléter les données.
- Cible absente ou devise incompatible : préciser ce qui manque.
- Statuts à vérifier, ou plus de 20 % de sources inconnues dans la cohorte globale : examiner la qualité des données.
- Au moins 5 annulations/retours et au moins 25 % des commandes : examiner les incidents.
- Plus de 20 % non résolues, ou moins de 70 % ayant au moins 7 jours : poursuivre le test et attendre les livraisons.
- Envisager une hausse uniquement avec au moins 20 commandes, 10 livrées et un coût au plus égal à 80 % de la cible, après les contrôles précédents.
- Coût supérieur à 125 % de la cible avec au moins 5 livrées et assez de recul : examiner le coût.
- Sinon, continuer le test en indiquant le manque de volume ou de signal.

**Aucune action Meta n’est disponible dans cette intégration.** Publier, mettre en pause ou modifier un budget nécessiterait une validation explicite distincte du propriétaire, jamais l’exécution automatique d’une recommandation.

## Livraison et vérifications

Les migrations sont additives : métadonnées publicitaires nullables sur les commandes, quatre tables Media Buyer vides et un index sur les événements. Pas de reprise fictive des anciennes sources ni de réécriture des données commerciales. Avant activation : tests et CI sur la source exacte, sauvegarde restaurable, migration du candidat, contrôle du rôle applicatif et des empreintes commerciales. Pour une installation existante utilisant un rôle limité, accorder seulement les droits des **nouvelles tables** ; ne jamais rejouer `runtime-permissions.sql`, réservé aux installations entièrement vides.

La recette utilise des bases PostgreSQL jetables, un compte publicitaire fictif, des réponses Graph simulées et des interfaces téléphone/tablette/ordinateur. Elle doit couvrir visite consentie, navigation, commande réelle dans la base isolée, statut livré simulé, rapport, retour après livraison, source inconnue, deux synchronisations, échec/pagination/concurrence, permissions, secrets et invariance des paiements/stocks. Aucun achat, colis, e-mail ou événement Meta réel ne doit être créé pour cette recette.

Après connexion du compte réel, il reste à vérifier : validité et durée du jeton, accès `ads_read`, revue/mode de l’application, compte/devise/fuseau, correspondance des dépenses quotidiennes avec Ads Manager et remplacement des macros sur une publicité validée par le marchand. Un test local ne prouve pas ces accès réels. Les relevés réels doivent être lus sans modifier les publicités.

Références officielles : [Insights](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights), [autorisations](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization), [compte publicitaire](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account), [versions Graph](https://developers.facebook.com/docs/graph-api/changelog/versions?locale=en_US).
