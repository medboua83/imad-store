# Double authentification du dashboard

Chaque administrateur ou collaborateur configure son propre compte depuis **Mon compte → Double authentification**. La publication ne l’active pas à la place du propriétaire : celui-ci doit ajouter sa clé à son application et prouver qu’il peut générer le code. Les comptes existants, leurs droits et mots de passe restent inchangés.

## Activation

1. Saisir le mot de passe actuel, puis choisir Configurer.
2. Scanner le QR code avec Google Authenticator, Microsoft Authenticator ou une application TOTP compatible. Sur le même téléphone, ajouter manuellement la clé affichée. Aucun service externe ne génère le QR.
3. Télécharger ou conserver les dix codes de secours, séparément du mot de passe, puis cocher la confirmation. Les codes sont affichés uniquement pendant cette préparation, conservés en mémoire du composant et jamais dans localStorage.
4. Saisir les six chiffres de l’application et confirmer. La préparation expire après dix minutes. Une nouvelle préparation remplace l’ancienne ; Annuler efface la préparation correspondante sans désactiver une protection déjà active.
5. Toutes les sessions sont révoquées et les cookies locaux sont effacés. Se reconnecter avec le mot de passe puis **le prochain code** de l’application : celui de l’activation a été consommé.

## Connexion et secours

Le mot de passe reste obligatoire à chaque connexion. Quand la MFA est active, une réponse intermédiaire `mfaRequired` ne délivre aucun accès, cookie ni refresh token. Le second envoi doit présenter le même compte, son mot de passe et un code valide. Le mot de passe reste uniquement dans l’état du formulaire et peut être effacé avec Changer de compte ; aucun jeton intermédiaire n’autorise l’API.

Un code TOTP déjà accepté ne ressert pas, y compris entre deux requêtes concurrentes, transports cookie/Bearer ou appareils. Les codes de secours sont à usage unique et leur consommation est transactionnelle. Le nombre restant est visible dans Mon compte. Pour remplacer l’application ou les codes, désactiver avec le mot de passe et un facteur encore valide, puis refaire la configuration. La désactivation révoque aussi toutes les sessions et les anciens codes de secours.

Une réinitialisation par e-mail change uniquement le mot de passe : elle ne retire pas la MFA. Sans téléphone ni code de secours, aucune route publique ou action d’un collaborateur ne contourne la protection. Une intervention d’exploitation doit d’abord vérifier l’identité du propriétaire, puis documenter une récupération ciblée et révoquer ses sessions ; ne jamais envoyer une clé ou un code par chat. L’envoi Gmail n’est pas une condition d’utilisation de la MFA.

## Modèle et exploitation

- TOTP RFC6238 : secret aléatoire de 160 bits, SHA1, six chiffres, pas de 30 secondes, fenêtre de dérive de ±1 pas. Synchronisation de l’horloge du serveur requise.
- Table additive `admin_mfa`, liée au compte. Seeds active et provisoire chiffrées AES-256-GCM avec la clé d’exploitation existante `DESKCOMM_ENCRYPTION_KEY` et contexte lié au compte. Ne pas modifier cette clé lors du déploiement.
- Dix codes de secours aléatoires de 96 bits, empreintes SHA256 contextualisées par compte. Ni seed en clair ni code de secours en clair en base, journaux ou audit.
- Limite IP des connexions conservée. Après cinq codes invalides pour un même compte, blocage persistant de quinze minutes, quel que soit l’IP. Le compteur d’échec est validé avant de répondre à l’échec ; une réussite le remet à zéro. Une préparation ne le réinitialise pas.
- Verrou transactionnel partagé avec les modifications de compte et les mots de passe. Dernier compteur TOTP consommé, empreintes de secours et révocation atomiques. Le rôle/état/version du compte est relu avant toute activation ou connexion.
- Activation et désactivation incrémentent `authVersion` et suppriment les lignes RefreshToken du compte ; les anciens accès Bearer sont également invalidés. La MFA n’est pas demandée à chaque renouvellement d’une session déjà authentifiée.
- Journal `access_events` : MFA_ENABLED, MFA_DISABLED et MFA_RECOVERY_USED, sans secret ni code. Lecture du statut limitée au propre compte ADMIN/STAFF ; aucune donnée privée dans les réglages publics.
- Migration `20261125170000_admin_mfa` : nouvelle table uniquement, sans réécriture des comptes ni données marchandes. Le runtime a SELECT/INSERT/UPDATE sur cette table ; les privilèges de migration restent distincts.
- Les clients API explicites restent compatibles : un compte protégé doit ajouter `code` à sa connexion. Le mot de passe seul ne produit pas de jetons. Les intégrations machine ne doivent pas réutiliser un compte personnel comme contournement.
- Ne pas revenir à une version applicative antérieure à ce lot après activation d’un compte : elle ignorerait la MFA. Conserver une version compatible pour toute reprise et ne jamais retirer la table pour contourner la protection.

## Recette

Recettes serveur sur PostgreSQL jetable : vecteurs RFC, absence de clés avant validation, chiffrement/contextualisation, expiration/remplacement/annulation, activation et révocation, replay concurrent, secours simultanés, blocage persistant, rôles/origines et récupération du mot de passe. Empreintes de commandes, stock, paiements, colis et outbox inchangées.

Recettes d’interface français/arabe sur téléphone et ordinateur : QR, téléchargement et sauvegarde explicite, focus du code, code erroné, secours, annulation, perte réseau et désactivation. Publication sauvegardée avec migration additive, vérification des permissions et tests sur la version réellement servie. Aucun compte réel n’est enrôlé par l’agent et aucune commande, vente, remboursement ou expédition n’est créé pour tester.

Références : [RFC6238](https://www.rfc-editor.org/rfc/rfc6238.html), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OTPAuth](https://github.com/hectorm/otpauth).
