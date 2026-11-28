# Sessions du dashboard

Les nouvelles connexions du dashboard utilisent des cookies HttpOnly. En production : Secure, SameSite=Strict, chemin /, aucun Domain et préfixe __Host-. Les cookies ne sont jamais renvoyés en JSON. Le navigateur conserve seulement une présentation non secrète (identifiant, rôle, permissions et version du compte), qui ne vaut jamais autorisation.

L’accès signé reste court (JWT_EXPIRES_IN, 15 min par défaut) et est lié à une ligne RefreshToken existante. La session a une échéance absolue (JWT_REFRESH_EXPIRES_IN, 7 jours par défaut). Le renouvellement conserve le cookie de récupération HttpOnly et la même échéance : il ne crée pas de nouvelle ligne et permet plusieurs onglets concurrents. La déconnexion supprime cette session ; les anciens accès signés liés à cette ligne sont alors refusés, même présentés comme Bearer. Les modifications de droits, la désactivation et le changement de mot de passe continuent de vérifier la version et le compte en base.

## Déploiement et origines

- HTTPS obligatoire en production ; ne pas retirer Secure pour contourner une erreur de configuration.
- SITE_URL doit contenir l’origine publique canonique de la vitrine (par exemple https://imadmode.com). Elle sert à vérifier Origin, avec Referer ou Fetch Metadata en repli. Une origine tierce ou un sous-domaine frère est refusé. Sans SITE_URL, seules les origines explicitement configurées dans CORS_ORIGIN sont utilisées ; localhost n’est un défaut qu’en développement.
- Le client joint X-Imad-Admin-Session: cookie. Les routes privées exigent aussi l’identité non secrète attendue et refusent une requête portant les cookies d’un autre compte. Ces en-têtes ne sont pas des clés d’accès : les cookies, la signature et la base sont toujours contrôlés.
- Le frontend et l’API doivent appartenir au même site. Une API sur un autre domaine indépendant est incompatible avec SameSite=Strict et doit être exposée par le proxy /api de la boutique. Les cookies sont propres à l’hôte qui les émet.
- Les routes privées et les réponses de session portent Cache-Control: private, no-store. Le proxy doit transmettre Cookie et toutes les lignes Set-Cookie ; ne pas mettre /api/auth ou les routes privées dans un cache partagé.

## Reprise des anciennes connexions

Un ancien navigateur contenant un véritable jeton de récupération l’échange une fois contre la session protégée, puis supprime adminToken et adminRefresh. L’identité de présentation conserve la même clé de caissier et de brouillon. Les onglets utilisant encore l’ancien JavaScript peuvent devoir être rechargés : enregistrer leurs formulaires avant la publication. Le nouveau code réagit aux changements de compte et aux déconnexions entre onglets, et masque aussi les tickets séparés quand la session disparaît.

Les clients explicites de l’API Bearer restent compatibles. L’échange consomme leur ancien jeton de récupération ; un ancien accès Bearer sans identifiant de session conserve sa durée résiduelle jusqu’à son expiration. Il n’est pas révoqué rétroactivement par l’échange. Changer le mot de passe ou révoquer les droits du compte invalide les anciennes versions. Ne pas prétendre que tous les anciens clients deviennent HttpOnly ou que ce lot active la double authentification.

## Contrôles

- Tests serveur sur base jetable : origines, cookies de production, révocation, renouvellements concurrents, migration unique, permissions, identité de compte et changement de mot de passe ; empreinte marchande inchangée.
- Tests navigateur : connexion, reprise, déconnexion, absence de clés dans JavaScript, téléphone/tablette/ordinateur, erreurs temporaires, plusieurs onglets et ticket de caisse séparé.
- Transport réel des cookies dans les modes TCP, Passenger et LiteSpeed.

Les cookies HttpOnly limitent le vol des clés par JavaScript ; ils n’empêchent pas un script malveillant exécuté sur la même origine d’effectuer des actions pendant une session. Conserver la CSP, les validations de contenu, les permissions serveur et les contrôles de publication. La MFA personnelle est décrite dans [ADMIN_MFA.md](ADMIN_MFA.md).

## Contrôles personnels des sessions

Dans **Mon compte → Sessions de connexion**, cliquer sur **Voir mes sessions**. La lecture est privée et paginée. Chaque entrée contient uniquement sa référence interne, sa date de création et son expiration absolue. La session actuelle est présentée séparément ; plusieurs onglets d’un même navigateur peuvent la partager. Ces dates décrivent l’ouverture et l’échéance, pas une dernière activité ni un appareil identifié.

**Fermer mes autres sessions** concerne toutes les pages de la liste. L’action exige le mot de passe actuel et, si elle est active, la MFA du compte (TOTP ou un code de secours utilisable). Le dernier code de secours reste réservé à la récupération. Les compteurs d’échec et l’exclusion d’un code déjà consommé sont partagés avec les autres actions MFA. Une action ayant réellement fermé des sessions laisse une entrée `OTHER_BROWSER_SESSIONS_CLOSED` dans `access_events`.

La session actuelle conserve sa ligne, ses clés, sa version de compte et son expiration. Les autres sessions navigateur existantes du même compte sont supprimées ; leurs accès liés sont immédiatement refusés, même présentés comme Bearer. Les comptes voisins, les clés API historiques, les configurations SMTP et les données commerciales sont conservés. Les connexions futures restent soumises aux identifiants et à la MFA : en cas de compromission présumée, changer aussi le mot de passe.

Les accès API historiques sans identifiant de session restent indépendants de cette liste et de ce bouton. Le changement de mot de passe ferme aussi ces accès par la version de compte. Les nouvelles pages utilisent la session navigateur protégée après la reprise prévue plus haut.

`GET /api/auth/sessions` et `POST /api/auth/sessions/close-others` acceptent uniquement une session navigateur complète, liée au compte attendu et à l’origine autorisée. Les accès Bearer seuls sont refusés, y compris lorsqu’ils contiennent un identifiant de session. Un administrateur comme un collaborateur peut agir sur ses propres sessions, avec les mêmes contrôles. Le corps strict ne permet de choisir ni un autre compte, ni la session à conserver. Les jetons, mots de passe, secrets MFA et codes ne sont pas renvoyés dans la liste.

La pagination limite chaque lecture et permet de traverser les anciennes lignes API sans les exposer. Une liste modifiée demande une actualisation ; une réponse incomplète conserve seulement la dernière lecture clairement signalée. Après un résultat de déconnexion incertain, relire la liste avant de réessayer. Le formulaire efface les secrets après chaque tentative et n’enregistre rien dans le stockage du navigateur. Les comptes exceptionnellement chargés sont orientés vers le changement de mot de passe ; le traitement échoué annule toutes ses suppressions et la consommation MFA.

Ce lot réutilise `refresh_tokens`, `admin_mfa` et `access_events`, sans migration ni élargissement des droits applicatifs. Les recettes de déconnexion utilisent exclusivement des comptes et bases fictifs. Sur la boutique réelle, consulter et annuler le formulaire : ne pas déconnecter des utilisateurs pour démontrer l’interface.
