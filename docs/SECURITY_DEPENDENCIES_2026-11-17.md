# Correctifs des dépendances — 17 novembre 2026

## Résultat du candidat

L'audit initial comporte 16 alertes : 12 modérées et 4 hautes. Le candidat obtient zéro alerte avec `npm audit --audit-level=low`, sans exclusion, seuil réduit ni liste d'ignorance.

- Next.js passe de 16.4.2 à 16.4.6, correction publiée des fuites de cache : GHSA-mfr8-8qww-v76h et GHSA-vc7v-qv4w-wrv8.
- typescript-eslint passe à 8.73.0 avec minimatch corrigé.
- Suppression de `resend`, SDK inutilisé. L'envoi existant dans `backend/src/lib/resend.ts` utilise déjà Nodemailer/SMTP ; aucun paramètre SMTP n'est changé. Cela supprime aussi les dépendances vulnérables de rendu et de formatage email.
- Picomatch est retiré de l'arbre installé. Aucun correctif officiel publié n'existe pour GHSA-fc5q-39xc-vjpf au moment du contrôle. Les deux consommateurs d'outillage, node-gyp et typescript-eslint, utilisent à la place l'adaptateur local explicite `@imad-store/glob-compat`, reposant sur `glob` 14.0.6 et son moteur maintenu. Ce n'est pas un faux changement de version de Picomatch ni un patch silencieux dans node_modules.

## Contrat et entretien de l'adaptateur

Le remplacement `tinyglobby` est verrouillé dans les overrides npm et le lockfile. Il expose les trois opérations réellement utilisées : `glob`, `globSync`, `isDynamicPattern`. Options vérifiées : `cwd`, `ignore`, `expandDirectories:false`. Toute option nouvelle ou négation non prise en charge échoue explicitement ; ce module n'est pas présenté comme une réimplémentation générale de Tinyglobby. Les chemins Windows sont normalisés comme avant, les répertoires exclus des résultats de fichiers.

Conserver ce contrôle lors des mises à jour de node-gyp/typescript-eslint. Une version officielle corrigée de leur moteur pourra remplacer l'adaptateur après audit et tests. Node-gyp n'est pas rétrogradé ; la compilation native des images doit être vérifiée sur le VPS avec son libvips existant.

## Validation

Quatre tests dédiés : recherche de projets natifs, résolution réelle d'un projet TypeScript avec exclusion de node_modules, motifs d'attaque exécutés dans un processus limité à deux secondes, absence des dépendances vulnérables dans le lockfile. Ils font partie de la CI via `npm run test:security`. Compilation, types et lint passent (un avertissement commerce-tab préexistant). Installation propre, suite fonctionnelle complète et contrôle du binaire image natif à consigner avant mise en ligne.

Les rapports bruts et sauvegardes restent hors Git. Aucun changement de base, commande, colis, donnée marchande ou secret. Enregistrer la source sur GitHub et valider les tests avant promotion de la version.

Sources : https://github.com/advisories/GHSA-fc5q-39xc-vjpf ; https://github.com/advisories/GHSA-mfr8-8qww-v76h ; https://github.com/advisories/GHSA-vc7v-qv4w-wrv8 ; https://github.com/isaacs/node-glob ; https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.73.0
