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

Les cookies HttpOnly limitent le vol des clés par JavaScript ; ils n’empêchent pas un script malveillant exécuté sur la même origine d’effectuer des actions pendant une session. Conserver la CSP, les validations de contenu, les permissions serveur et les contrôles de publication. La MFA et la gestion des appareils restent des évolutions distinctes.
