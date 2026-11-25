# Composants tiers

Cette application utilise des bibliothèques tierces. Leurs licences et notices sont conservées dans les paquets réinstallés par `npm ci` ; leur code n'est pas couvert par la réserve de droits du code spécifique.

L'inventaire de versions et d'identifiants de licence des dépendances de production et optionnelles est dans `docs/DEPENDENCY_LICENSES.json`. Il est généré depuis le lockfile avec :

```sh
node scripts/dependency-license-report.cjs > docs/DEPENDENCY_LICENSES.json
```

Une valeur `UNDECLARED` exige une revue de la notice du paquet avant distribution. Une licence renseignée dans le lockfile n'est pas une preuve que toutes les obligations de distribution ont été satisfaites. Conserver les fichiers LICENSE/NOTICE effectivement fournis avec les dépendances, y compris pour les bibliothèques natives et leurs binaires. Ne pas retirer une attribution lors d'une modification.

Le kit source n'inclut ni `node_modules`, ni les sauvegardes, ni les fichiers `.env`, ni les photos téléversées. Le client réinstalle les dépendances verrouillées pour son système. Les textes de licence ne s'appliquent pas automatiquement aux marques et photos de la boutique.
