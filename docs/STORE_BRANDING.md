# Identité publique de la boutique

Dans **Paramètres → Identité de la boutique**, le titulaire du droit `settings.manage` peut modifier le nom public, deux logos (fonds clairs et sombres), les couleurs principale/accent/fond, l’e-mail de contact, le téléphone et l’adresse publique. L’enregistrement publie explicitement la nouvelle identité ; l’aperçu reste privé auparavant. Annuler les modifications revient à la dernière lecture enregistrée.

Les logos sont importés avec le circuit image existant : PNG, JPEG ou WebP de 5 Mo maximum, conversion serveur WebP, nom immuable et local. Aucun SVG, URL distante, HTML ou CSS libre. Les images sont affichées en entier, sans recadrage. Le logo sombre est facultatif et reprend le logo principal. Sans logo et avec un nom différent, le nom remplace le monogramme IMAD. Les icônes de navigateur restent les assets de l’installation ; ce lot ne fournit pas un éditeur de favicon.

Les valeurs par défaut conservent le nom et le logo sélectionnés IMAD Mode ainsi que les nuances existantes. Aucune variable de couleur ne surcharge le thème lorsque les trois couleurs sont inchangées. Les textes des contrôles personnalisés choisissent un premier plan blanc ou noir ; les couleurs sémantiques des statuts et alertes restent indépendantes. La lisibilité d’un logo importé relève de sa version claire/sombre.

Le nom se propage à la navigation, au pied de page, aux principaux écrans client et administrateur, aux titres/partages et aux nouveaux e-mails d’accès. Les coordonnées sont visibles sur Contact et dans le pied de page ; les champs vides sont masqués. L’e-mail public ne modifie ni l’expéditeur ni le secret SMTP. Les réseaux sociaux/WhatsApp conservent leur réglage dédié. L’identité juridique et les politiques déjà publiées ne sont pas réécrites automatiquement ; elles restent dans Contenu du site. Le texte marketing libre et les photos incorporant un ancien logo ne sont pas réécrits.

## Persistance et concurrence

Migration additive `20261125190000_store_branding` : une table `store_branding`, aucun enregistrement initial ni changement de données commerciales. Avant le premier enregistrement, l’adresse déjà publiée et vérifiée est conservée comme repli. Les autres valeurs par défaut sont fournies sans écriture.

`GET /api/settings` retourne les seules valeurs publiques résolues. `GET/PUT /api/settings/branding` requièrent une session valide et le droit `settings.manage`. Un enregistrement complet exige la révision attendue, puis incrémente celle-ci atomiquement. Un conflit ne remplace pas les valeurs de l’autre fenêtre. Une réponse perdue est relue avant d’annoncer un succès ; sinon la saisie et sa révision restent affichées pour reprise. Aucun secret dans ce document public de configuration.

Le rôle applicatif reçoit SELECT/INSERT/UPDATE sur cette seule nouvelle table ; pas DELETE. Le profil de migration reste séparé. Valider la migration sur une restauration privée avant activation. Les essais ne doivent modifier ni l’identité de la boutique active, ni ses commandes, paiements, stocks, colis, intégrations, sessions ou comptes MFA. La version précédente est déjà compatible avec la MFA : garder cette protection dans tout retour applicatif.

## Recette

Tester français/arabe à 390/768/1440 px : aperçu sans publication, sauvegarde/rechargement, liens téléphone/e-mail, couleurs, nom long, logos et retour au texte, panne de lecture, panne d’enregistrement, réponse perdue et modifications concurrentes. Contrôler la palette IMAD sans surcharge et les photos produits inchangées. Les scénarios d’écriture utilisent exclusivement les API simulées ou une base locale jetable ; la vérification de production se fait en lecture seule.
