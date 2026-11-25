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

## Copie hors serveur

Convenir avec le propriétaire du stockage, du chiffrement, de la rétention et de la conservation séparée des moyens de déchiffrement. Une copie sur le même serveur ne protège pas contre sa perte. Une copie manuelle non vérifiée ne constitue pas un dispositif automatique. Ne jamais mettre une sauvegarde contenant des profils ou clients à disposition par une URL publique pour faciliter son transfert.

À la réception, vérifier l'intégrité de la copie et rejouer le contrôle sur un environnement approprié. L'accès aux données du marchand doit être limité aux personnes autorisées. Ne pas charger une base IMAD remplie dans la boutique d'une autre entreprise.

## Reprise réelle après incident

1. Identifier la dernière sauvegarde vérifiée et la révision du code compatible ; conserver la version active et les preuves d'incident.
2. Préparer un environnement indépendant, ses permissions et son stockage persistant. Désactiver les travailleurs d'envoi pendant la restauration et la recette. Ne jamais appliquer un dump sur la base active pour « essayer ».
3. Restaurer avec un opérateur compétent, reconnecter les profils et les clés propres à cette boutique, vérifier les migrations et les droits applicatifs. Préserver les bornes historiques de l'outbox.
4. Contrôler les commandes, paiements, stocks, tickets de caisse, retours et identités des colis, puis le catalogue et les photos. Ne pas rejouer les écritures externes pour les tester.
5. Basculer seulement après validation, vérifier le domaine, la santé et les lectures authentifiées, puis réactiver les travailleurs nécessaires avec surveillance des files et erreurs. Une bascule doit disposer d'un retour arrière compatible avec le schéma de données.

Désigner le responsable de la surveillance, de la copie hors serveur, des essais de restauration et des mises à jour. Noter date, version, résultat et temps mesuré de chaque recette, sans publier de données privées.
