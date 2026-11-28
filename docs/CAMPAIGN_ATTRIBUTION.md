# Attribution directe des commandes aux campagnes

La boutique enregistre facultativement les paramètres publicitaires déclarés par le lien d’arrivée avec chaque **nouvelle commande web**. Le module [Media Buyer](MEDIA_BUYER.md) les rapproche des dépenses Meta et des statuts de livraison ; aucune plateforme ou agent supplémentaire n’est créé.

## Paramétrer les publicités Meta

Dans **Meta Ads Manager → niveau Publicité → Suivi (Tracking) → Paramètres URL (URL parameters)**, coller cette ligne sans `?` initial. Conserver l’adresse de la fiche produit dans le champ URL du site web. Ne pas mettre de coordonnées personnelles dans les paramètres :

```
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

Les trois clés de rapprochement sont exactement `campaign_id`, `adset_id` et `ad_id` (pas `ad_set_id`). Les UTM de cet exemple utilisent les IDs plutôt que les noms, pour éviter les noms trop longs ou contenant des caractères refusés.

Références officielles Meta : [spécifications des paramètres dynamiques](https://www.facebook.com/business/help/2360940870872492) et [ajout de paramètres URL dans Ads Manager](https://www.facebook.com/business/help/1016122818401732). Contrôle public du 26 novembre 2026 : après un premier accès HTTP bloqué, lecture publique du guide et de la section repliée « Dynamic parameters » dans les spécifications officielles. Les valeurs exactes observées sont Campaign ID → `{{campaign.id}}`, Ad set ID → `{{adset.id}}`, Ad ID → `{{ad.id}}`. Le guide confirme Tracking → URL parameters, les paires `clé=valeur` séparées par `&` et le bouton Apply. La compatibilité de la chaîne après remplacement fictif des macros est également vérifiée par le parseur local. Aucune connexion de compte supplémentaire, modification de publicité ou dépense publicitaire ; la substitution sur une vraie publicité n’a pas été testée.

Meta doit remplacer ses macros par les identifiants réels avant l’arrivée. Les macros non remplacées sont ignorées. Les identifiants sont des **chaînes**, jamais des nombres JavaScript, pour conserver leur précision. `utm_id` et `utm_term` sont également acceptés. Les libellés UTM sont limités à 100 caractères : lettres, chiffres, espace, point, tiret et soulignement. Les identifiants Meta acceptent 5 à 25 chiffres. Valeurs répétées, URL, e-mail, contrôles et autres valeurs invalides sont ignorés. Aucun `fbclid`, référent, URL complète, jeton, IP ou identifiant de navigateur n’est conservé dans l’attribution. Ne jamais mettre des coordonnées client dans les UTM ; la validation de forme ne peut pas reconnaître toutes les données personnelles déguisées en libellés.

## Règle et consentement

Modèle versionné `last_tagged_touch_30d` : dernière arrivée comportant au moins un paramètre valide, capture de l’ensemble des champs de cette arrivée, sans fusion avec une ancienne campagne. Une visite directe ne remplace ni ne prolonge le lien. Relire le même jeu de paramètres ne prolonge pas sa date. Le lien expire après 30 jours ; absence de lien signifie attribution inconnue, jamais « organique » inférée.

Le choix explicite versionné `campaign-order-v1` est requis avant toute conservation ou transmission. L’ancien choix Pixel seul ne vaut pas ce nouvel accord. Le panneau arabe explique les durées et permet d’accepter/refuser ; il apparaît sur une arrivée balisée sans choix actuel. Le bouton public de préférences permet de retirer l’accord. Aucun achat ne dépend de ce choix. Le refus/retrait efface le lien local et empêche sa transmission ; DNT, GPC, administrateurs, `stats_test`, HTTP et boucle locale sont exclus. Le choix est valable 180 jours ; le lien, au plus 30 jours, dans le même navigateur/origine. Une valeur expirée est ignorée et retirée à la prochaine utilisation de la boutique ; un navigateur fermé ne peut pas exécuter de nettoyage. Le retrait agit sur le stockage partagé entre les onglets et chaque soumission revérifie le choix actuel. Si le visiteur quitte la page avant d’accepter, aucune arrivée antérieure n’est reconstruite. Le retrait local ne peut pas identifier et effacer les commandes déjà enregistrées : leur métadonnée expire automatiquement et une demande d’effacement existante doit être traitée par le marchand.

L’API revalide la forme et les dates, ignore les métadonnées invalides sans empêcher l’achat et respecte DNT/GPC. Cette information reste **déclarative et falsifiable** : elle ne certifie pas un clic, la propriété de la publicité, une causalité ni le ROAS Meta. Pas de rapprochement entre appareils, de reconstruction d’anciennes commandes ou de modification des montants, paiements, statuts, stock, expéditions, CRM, Pixel Purchase ou eventID.

## API et conservation

`POST /api/orders` accepte facultativement `campaignAttribution` : version, modèle, tags autorisés, `capturedAt` et `consentAt` en millisecondes UTC, version d’avis. Une fois la commande créée, une répétition avec la même clé idempotente retrouve la même commande et son attribution initiale. L’attribution est exclue de l’empreinte commerciale pour préserver les reprises des anciens clients ; aucun ajout sur une commande existante, même précédemment sans attribution.

La migration PostgreSQL additive `20261126190000_order_campaign_attribution` ajoute seulement deux colonnes nullables et un index. Aucun backfill/default d’attribution, aucune suppression de commandes. Appliquer avec `prisma migrate deploy` après sauvegarde, avant démarrage de la nouvelle application ; ne pas utiliser `db push`.

Les lectures `/api/orders` et `/:id/admin-details` exigent `orders.read`. L’export CSV exige `orders.export` et ajoute les UTM, IDs Meta, modèle, date d’arrivée et preuve de choix. Les IDs CSV sont protégés comme texte et toutes les cellules contre les formules. Le suivi invité et les reçus publics de création/reprise n’exposent pas l’attribution. Les règles d’accès et filtres de commande existants restent applicables ; aucune nouvelle clé ou route publique de lecture.

Les anciennes commandes, les arrivées sans paramètres utilisables, le refus ou l’expiration du choix, et un achat depuis un autre appareil/navigateur peuvent rester **sans attribution**. Ne pas leur inventer une campagne.

**Pixel Purchase ne signifie pas paiement encaissé.** Dans le parcours COD actuel, il accompagne l’enregistrement réussi de la commande ; le paiement peut rester `PENDING`. Media Buyer garde séparés commande enregistrée, livraison et encaissement réellement rapproché ; ce dernier n’est pas affiché sans données fiables.

L’attribution en base expire **90 jours après la commande**. Les lectures privées et exports masquent immédiatement les données expirées, même si le nettoyage a échoué. Au démarrage de chaque processus API et chaque heure, un nettoyage indexé met seulement les deux colonnes publicitaires à NULL, sans modifier `updatedAt` ni les données commerciales. `scripts/prune-analytics.cjs` nettoie aussi ces colonnes pour les exploitations avec ordonnanceur existant. Un échec produit un message générique, sans URL ou valeur. Les sauvegardes suivent leur politique propre : une restauration doit exécuter ce nettoyage avant de rouvrir les lectures.

## Livraison et retour arrière

Tester sur une base jetable avec fixtures et réseaux externes bloqués. Avant publication : CI réussie sur la source exacte, sauvegarde restaurable, contrôle du rôle SQL runtime (lecture/écriture des colonnes ajoutées), migration additive, candidat sans workers externes, vérification des empreintes commerciales et activation normale. Ne pas tester une vraie commande, publicité, expédition ou notification. Une ancienne application peut fonctionner avec ces colonnes supplémentaires ; conserver la migration en cas de retour arrière, puis conserver une tâche de rétention sur la version compatible. Ne pas rejouer l’historique ni activer une intégration externe pour valider ce lot.
