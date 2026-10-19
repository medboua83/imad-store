# Roadmap — stabilité, performance et facilité d’utilisation

## Identité administrative et numéros CRM — candidat du 19 octobre 2026

L’administration précise qu’une installation historique ne possède pas d’identifiant de boutique. Les nouveaux profils affichent leur identifiant en lecture seule avec copie ; aucun identifiant de source ou de commande n’est présenté comme une identité d’installation. Le CRM peut rattacher le circuit historique existant sans créer une source supplémentaire ni adopter une base remplie. Aucun réglage de production modifié par ce code seul.

Le formulaire CRM sortant normalise les numéros marocains locaux en +212 ; les valeurs déjà internationales sont conservées. Aucun ancien contact ni événement de file n’est réécrit. 39 tests d’intégration sur base locale jetable réussis, compilation backend et lint frontend réussis. Compilation isolée combinée et trois tests du serveur hébergé réussis ; publication à vérifier. La validation réelle précédente de la connexion historique utilise uniquement la commande fictive 9BD3D8F8 : un prospect, transmission en une tentative et retour automatique Confirmée ; aucune clé en clair n’a été récupérée ou publiée.

Audit de référence : [18 octobre 2026](AUDIT_SITE_2026-10-18.md). Le lot P1 est implémenté et testé ; voir [les corrections et leurs limites](PRIORITY_FIXES_2026-10-18.md). Le lot P2 est également implémenté ; voir [ergonomie et performance](USABILITY_PERFORMANCE_2026-10-18.md). Les informations commerciales réelles et les mesures terrain restent à compléter.

## Lot 1 — Sécurité et intégrité

- [x] A01 : limiter le suivi invité aux informations autorisées.
- [x] A02 : authentifier les notifications et l’association des numéros Telegram.
- [x] A03 : verrouiller la capacité de paiement inutilisée ; vérifier les montants avant toute activation.
- [x] A04 : centraliser les transitions de commande et la restitution du stock.
- [x] A08 : valider les paramètres API et supprimer les diagnostics internes des réponses publiques.
- [x] A09 : trier les avis de dépendances et appliquer les correctifs sur une branche dédiée.
- [x] A21 : créer une CI avec base et CRM de test isolés, sans accès aux clients réels.

## Lot 2 — Catalogue et administration utilisables

- [x] A05–A06 : formulaire produit complet, variantes/stock et véritable stockage des images.
- [x] A07 : isoler les démonstrations, contrôler la publication et afficher uniquement le catalogue prêt.
- [ ] Catalogue réel : fournir et valider photos, descriptions et variantes avant la mise en vente.
- [x] A10 : contrôler les quantités du panier et les variations de prix/disponibilité.
- [x] A11 : configuration du site persistée côté serveur avec brouillon, aperçu et publication.
- [x] A12–A13 : recherche, tri, pagination et reprise après erreur réseau.
- [x] A19–A20 : sessions administrateur fiables et jeux de démonstration distincts du démarrage de production.

## Lot 3 — Parcours clients plus simples

- [x] A14–A15 : dialogues accessibles, focus clavier, mouvement réduit et lisibilité mobile.
- [x] A16 : métadonnées produit, vraies pages 404, sitemap et règles d’indexation.
- [x] A18 : informations commerciales validées et preuves sociales vérifiées.

## Lot 4 — Performance mesurée

- [x] A17 : établir les mesures de production avant optimisation.
- [x] Réduire les requêtes après hydratation, mutualiser les réglages et charger les onglets lourds à la demande.
- [x] Héberger les polices localement et distinguer cache public et réponses privées.
- [x] Vérifier les régressions sur mobile et ordinateur avec des budgets explicites.

## Règles de validation

Chaque lot doit fournir un résultat vérifiable et une possibilité de retour arrière. Conserver les index MongoDB existants ; ne pas exécuter prisma db push sur la base active. Les tests de répétition utilisent un CRM simulé et ne rejouent jamais les anciennes entrées de la file réelle. Une réception unique précédemment observée ne certifie pas tous les scénarios de panne.

## Après les deux lots

- [ ] Fournir et valider les délais, conditions de retour et identité/adresse commerciale avant publication.
- [ ] Observer les performances terrain après une éventuelle mise en ligne sur le domaine final.

## Reusable company installations — 2026-10-19

- [x] Fresh isolated profile generator, database identity/index bootstrap, encrypted per-company confirmation setup and isolated tests. See COMPANY_STORE_TEMPLATE_2026-10-19.md.
- [ ] Optional future CRM-side self-service provisioning of enterprises, sources and rules; outside this store repository.
