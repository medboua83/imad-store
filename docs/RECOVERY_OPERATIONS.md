# Sauvegarde et reprise d'une boutique

Une archive valide n'est pas encore une restauration prouvée. Conserver séparément la base PostgreSQL, les images persistantes, les profils privés et la version du code, ainsi que les clés nécessaires au déchiffrement des intégrations. Ne jamais placer ces éléments privés dans Git ou dans un répertoire public.

## Vérifier sans toucher à la boutique active

Le vérificateur `scripts/verify-store-backup.py` s'exécute en root sur l'hôte Linux PostgreSQL, via son socket local `/var/run/postgresql`, port 5432. Il ne lit aucune variable PG* ou profil applicatif. Le dossier de sauvegarde et ses fichiers doivent appartenir à root, sans droits de groupe/autres et sans lien symbolique.

Il attend exactement les quatre entrées SHA-256 de `SHA256SUMS` : `store.dump`, `uploads.tar.gz`, `app.env` et `migrate.env`. Les autres fichiers du dossier ne sont pas appliqués. Il vérifie chaque fichier, lit l'archive photo sans l'extraire et compare chaque WebP à son nom immuable. Les liens, chemins traversants, doublons et archives dépassant ses limites sont refusés.

Sur le serveur, avec une sauvegarde privée existante et un dossier de rapport privé :

```sh
python3 /chemin/version-verifiee/scripts/verify-store-backup.py \
  --backup /chemin/prive/sauvegarde \
  --output /chemin/prive/rapport-nouveau.json
```

Le rapport doit être un nouveau fichier. Le programme crée une base aléatoire `imad_restore_<32 caractères hexadécimaux>` depuis template0, restaure le dump sans propriétaire ni privilèges hérités, vérifie le schéma et les volumes, puis supprime uniquement cette base qu'il a effectivement créée. Une création échouée n'autorise aucune suppression. Aucun serveur applicatif, travailleur, envoi CRM, e-mail ou appel transporteur ne démarre sur la copie. Le rapport contient seulement des volumes et des résultats, sans données de ligne ni secret. Les erreurs SQL ne sont pas réaffichées, car elles pourraient contenir des données privées.

Ce contrôle prouve la restauration PostgreSQL et l'intégrité des fichiers. Il ne prouve pas la disponibilité d'un autre hébergeur, le fonctionnement des intégrations, la possession des clés à distance ou l'existence d'une copie hors serveur. Ne pas annoncer une durée maximale de reprise ou une perte maximale de données avant une recette complète et un accord d'exploitation.

## Copie hors serveur chiffrée et recette indépendante

L'outil `scripts/offsite-recovery.py` complète le vérificateur Linux historique. Il ne connaît aucune connexion de production et n'accepte pas de base cible existante. La recette crée **un nouveau cluster PostgreSQL local**, sans écoute TCP, restaure le dump complet et les images dans un dossier privé puis supprime cette copie. Les variables PG*, les profils de démarrage et DATABASE_URL de l'opérateur ne sont pas hérités. Aucun serveur de boutique, worker, navigateur, appel transporteur ou envoi d'e-mail n'est démarré.

Prévoir Python 3, age, Node 22 et les exécutables PostgreSQL 16 compatibles avec le dump. Utiliser un compte local sans privilèges root et un stockage privé ayant assez de place pour deux copies déchiffrées et le cluster. Le chemin de travail doit être court (socket Unix) et ne pas contenir d'espace. Ne pas choisir un volume de travail synchronisé ou partagé publiquement.

### Contenu et création

Le dossier privé de préparation contient les quatre fichiers historiques (`store.dump`, `uploads.tar.gz`, `app.env`, `migrate.env`), leur `SHA256SUMS`, ainsi que :

- `source.tar.gz` : archive du code compatible, sans dépendances, compilation ni secret ; le nom de version seul ne suffit pas ;
- `snapshot.json` : au minimum `sourceCommit` (SHA Git complet) et, recommandé, date UTC, version PostgreSQL et version active ;
- facultativement `permissions.json` (rôle d'exécution, droits par table/colonne/séquence, sans hash de mot de passe), `runtime-service.txt`, `source-release.txt` et `source-patch.json`.

Ne jamais sauvegarder les rôles globaux d'autres applications sur un serveur partagé. Le dump conserve les tables d'intégration, files, comptes, sessions, MFA, caisse et migrations ; les clés de chiffrement propres à la boutique sont dans son profil applicatif. Les certificats HTTPS devront être réémis sur un nouvel hébergeur. Les dépendances natives et la compilation devront être recréées pour sa plateforme.

Générer une clé age propre au marchand avec `age-keygen`, conserver **l'identité secrète séparément des archives** (coffre-fort ou trousseau, plus un moyen de récupération indépendant), et ne fournir au chiffrement que son destinataire public. Transférer le snapshot par SSH avec clé d'hôte vérifiée ; jamais par une URL publique. Révoquer toute clé SSH temporaire après transfert. Le fichier déchiffré d'identité utilisé pour la recette doit être privé et supprimé ensuite.

Exemple à adapter, avec des chemins absolus privés appartenant à l'opérateur et sans liens symboliques ; tous les fichiers de préparation sont en 0600 et les dossiers en 0700 :

```sh
python3 scripts/offsite-recovery.py seal \
  --snapshot /stockage/prive/snapshot \
  --recipient /stockage/prive/destinataire-public.txt \
  --age /chemin/age \
  --output /stockage/prive/nouvelle-sauvegarde.tar.age
```

L'outil vérifie les sommes de contrôle et les photos immuables avant chiffrement, refuse les sources liées ou traversantes et produit un manifeste SHA-256 de tous les fichiers **dans** l'archive authentifiée age. Il n'écrase pas une sauvegarde existante. Conserver aussi l'empreinte SHA-256 chiffrée sur un support de confiance. La commande de recette exige cette empreinte. Une empreinte voisine d'une archive ne suffit pas contre un attaquant pouvant remplacer les deux : la clé age reste séparée. Le chiffrement age ne signe pas l'identité de l'expéditeur ; quiconque possède le destinataire public peut créer une archive. Ne restaurer que ses propres sauvegardes, dont la provenance est vérifiée par SSH et par une empreinte reçue sur un canal de confiance. Comme toute restauration PostgreSQL, la restauration du schéma exécute du SQL de la sauvegarde : ne jamais essayer une archive provenant d'un tiers non fiable sur ce Mac.

### Recette sur la copie reçue

```sh
python3 scripts/offsite-recovery.py probe \
  --archive /stockage/prive/nouvelle-sauvegarde.tar.age \
  --identity /stockage/prive/identite-temporaire.txt \
  --workspace /stockage/prive/recette \
  --pg-bin /chemin/postgresql16/bin \
  --age /chemin/age --node /chemin/node22 \
  --expected-sha EMPREINTE_SHA256_CHIFFREE \
  --output /stockage/prive/nouveau-rapport.json
```

Le contrôle exige un nouveau rapport, refuse liens et chemins inattendus, authentifie le déchiffrement puis vérifie chaque fichier. Le dump est restauré sans propriétaire ni privilèges hérités dans le nouveau cluster, toutes les contraintes doivent être validées. Chaque table possède un volume et une empreinte de ses lignes triées ; les valeurs des séquences sont aussi couvertes. Les images sont effectivement restaurées et tous les chemins `/uploads/<sha256>.webp` référencés par les données doivent exister.

La recette vérifie que les deux profils désignent la même boutique, que les clés d'authentification sont présentes et que les valeurs chiffrées CRM, transporteur, SMTP ou MFA présentes peuvent être déchiffrées par la clé archivée. Les profils sont analysés comme données, **jamais chargés dans l'environnement** et jamais utilisés pour se connecter. Le rapport n'enregistre ni données de clients, ni jetons, ni valeurs déchiffrées. Une mauvaise identité age, une archive corrompue ou une photo manquante échoue sans produire de preuve de succès.

Le cluster est arrêté avant suppression des fichiers temporaires. Si son arrêt échoue, le dossier privé est conservé pour examen au lieu de retirer les fichiers d'un serveur encore actif. Après un succès, supprimer aussi les fichiers temporaires de transfert, le snapshot clair d'origine et l'identité age temporaire. Une suppression de fichiers n'est pas une garantie d'effacement physique des anciens blocs d'un SSD : employer aussi le chiffrement du disque de travail.

### Exploitation et vente

Une première copie chiffrée hors VPS et deux restaurations indépendantes ont été réalisées le 25 novembre 2026 sur le matériel du propriétaire ; les preuves privées restent sur DATA. Cela établit une récupération **des données, fichiers et clés de cet instant**, pas une bascule du domaine ni une disponibilité continue.

Avant de vendre une offre avec sauvegarde automatique, fixer par écrit : destination distante, fréquence, rétention, responsable, alerte d'échec, récupération de clé et essai périodique. Un disque DATA déconnecté ou un Mac éteint ne reçoit pas de nouvelle copie. Ne pas présenter cette copie ponctuelle comme une sauvegarde cloud automatique ; la sauvegarde quotidienne sur le VPS reste un dispositif distinct. Ne pas effacer les anciennes copies tant que leur remplacement et la récupération de clé ne sont pas prouvés.

Pour un autre marchand, partir du kit vide et de nouvelles clés. **Ne jamais distribuer l'archive IMAD, ses clients, ses identifiants ou ses photos sous prétexte de fournir une démonstration.** Les tests GitHub utilisent uniquement des données fictives et ne reçoivent aucune archive privée.

## Choisir et surveiller la destination durable

Convenir avec le propriétaire du stockage, du chiffrement, de la rétention et de la conservation séparée des moyens de déchiffrement. Une copie sur le même serveur ne protège pas contre sa perte. Une copie manuelle non vérifiée ne constitue pas un dispositif automatique. Ne jamais mettre une sauvegarde contenant des profils ou clients à disposition par une URL publique pour faciliter son transfert.

À la réception, vérifier l'intégrité de la copie et rejouer le contrôle sur un environnement approprié. L'accès aux données du marchand doit être limité aux personnes autorisées. Ne pas charger une base IMAD remplie dans la boutique d'une autre entreprise.

## Reprise réelle après incident

1. Identifier la dernière sauvegarde vérifiée et la révision du code compatible ; conserver la version active et les preuves d'incident.
2. Préparer un environnement indépendant, ses permissions et son stockage persistant. Désactiver les travailleurs d'envoi pendant la restauration et la recette. Ne jamais appliquer un dump sur la base active pour « essayer ».
3. Restaurer avec un opérateur compétent, reconnecter les profils et les clés propres à cette boutique, vérifier les migrations et les droits applicatifs. Préserver les bornes historiques de l'outbox.
4. Contrôler les commandes, paiements, stocks, tickets de caisse, retours et identités des colis, puis le catalogue et les photos. Ne pas rejouer les écritures externes pour les tester.
5. Basculer seulement après validation, vérifier le domaine, la santé et les lectures authentifiées, puis réactiver les travailleurs nécessaires avec surveillance des files et erreurs. Une bascule doit disposer d'un retour arrière compatible avec le schéma de données.

Désigner le responsable de la surveillance, de la copie hors serveur, des essais de restauration et des mises à jour. Noter date, version, résultat et temps mesuré de chaque recette, sans publier de données privées.
