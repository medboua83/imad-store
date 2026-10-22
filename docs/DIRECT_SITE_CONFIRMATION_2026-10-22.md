# Confirmation directe sur le site

## Confirmation directe sur le site — candidat du 22 octobre 2026

Paramètres → Gestion des commandes : option persistante désactivée par défaut. Lorsqu’elle est activée, le checkout arabe ajoute une relecture complète modifiable, puis une validation finale. Le serveur vérifie le mode et les montants, crée une commande CONFIRMED avec confirmationMethod=SITE et confirmedAt, et neutralise la demande d’assistance de confirmation WhatsApp. Les notifications et la file CRM restent en place ; seuls les nouveaux événements SITE incluent confirmation_method, confirmed_at et confirmation_required=false. Le sender force aussi ai_service_consent=false pour SITE, en JSON signé comme dans le formulaire historique. Aucune ancienne commande ni file existante réécrite.

La confirmation n’est ni une vérification du téléphone ni une garantie de livraison. Le statut métier reste compatible avec les actions administrateur et le retour CRM. Le défaut absent/false conserve le checkout, la capture d’accord WhatsApp, le statut PENDING et le protocole des anciens événements. La clé d’idempotence et la garde synchrone côté client protègent double clic et reprise réseau. Pas de db push, fusion ou déploiement de ce candidat sans nouvelle autorisation. Les règles externes CRM personnalisées ne sont pas éditées par cette PR.

Validation locale : génération Prisma, compilation backend/frontend, lint, cinq tests Playwright avec données fictives (390/1440 px, relecture/modification, double clic, erreur réseau, réglage ON/OFF), sept tests de consentement/formulaire CRM et audit sans vulnérabilité. Le scénario MongoDB isolé couvre persistance, autorisations, activation/désactivation, montant incorrect, concurrence, métadonnées, compatibilité historique, webhooks signés et transitions manuelles. Résultat de la CI consigné dans la Pull Request ; aucun test ni message envoyé aux services de production.

## Lecture et activation future

Après validation et autorisation de déploiement : ouvrir Paramètres, Gestion des commandes, activer l’interrupteur et Enregistrer. Sans activation, le fonctionnement existant est conservé. Désactiver l’option restitue le parcours standard pour les nouvelles commandes ; les commandes déjà enregistrées conservent leur méthode/date/statut. Un checkout devenu obsolète reçoit un 409 et doit relire les nouveaux réglages.

## Compatibilité CRM

Le contrat existant exige l’accord d’assistance pour lancer la confirmation WhatsApp. Pour les nouvelles commandes SITE, cet accord est enregistré et transmis à false, même si un ancien client l’envoie à true. Le webhook de commande reste émis avec la référence et le statut CONFIRMED ; les marqueurs SITE sont additionnels. Les jobs historiques conservent leurs payloads et leur coupure temporelle. Le simulateur local vérifie le contenu et la signature ; cette recette n’envoie aucun WhatsApp réel et ne certifie pas des règles externes qui ignoreraient ce contrat.

## Fichiers et tests

- Paramètres : schema.prisma, settings.controller.ts, api.ts, order-settings.tsx, commerce-tab.tsx, page.tsx admin.
- Création : order.controller.ts, deskcomm-crm.ts ; détails administrateur : orders-tab.tsx.
- Checkout : checkout/page.tsx, CheckoutReview.tsx, checkout.css.
- Tests : integration.test.ts, deskcomm-form.test.ts, tests/ui/direct-confirmation.spec.ts, playwright.config.ts, verify.yml ; Playwright est une dépendance de développement uniquement.
- Les résultats CI définitifs et le lien vers les traces fictives sont fournis dans la PR. La production reste inchangée tant que la PR n’est pas explicitement approuvée pour déploiement.
