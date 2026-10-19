# Imad Store — Persistent Project Memory

## Liaison historique vérifiée en production — 19 octobre 2026

Publication Hostinger de la PR #26 vérifiée sur quickydev.com (fusion `8a970e622c2c438c0ca3346596bbba255899c9cd`). Le CRM publié `saas-4b66faca1` rattache la source et la règle existantes, sans autre connexion, nouvelle clé ou identité d’installation inventée. L’administration boutique explique cette installation historique ; les nouveaux profils affichent leur identifiant en lecture seule avec copie.

Commande fictive **3777E1A2** : envoi en une tentative, une réception et un prospect dans le CRM, numéro local correctement transmis en +212 ; confirmation depuis le CRM revenue automatiquement sur la seule commande filtrée. Paiement resté en attente. Aucun envoi WhatsApp, appel IA ou colis. Les 39 tests MongoDB jetables, la compilation isolée et les trois protocoles du serveur hébergé restent applicables au code inchangé. Les sections de candidat ci-dessous sont historiques.

## Identité administrative et numéros CRM — candidat du 19 octobre 2026

L’administration précise qu’une installation historique ne possède pas d’identifiant de boutique. Les nouveaux profils affichent leur identifiant en lecture seule avec copie ; aucun identifiant de source ou de commande n’est présenté comme une identité d’installation. Le CRM peut rattacher le circuit historique existant sans créer une source supplémentaire ni adopter une base remplie. Aucun réglage de production modifié par ce code seul.

Le formulaire CRM sortant normalise les numéros marocains locaux en +212 ; les valeurs déjà internationales sont conservées. Aucun ancien contact ni événement de file n’est réécrit. 39 tests d’intégration sur base locale jetable réussis, compilation backend et lint frontend réussis. Compilation isolée combinée et trois tests du serveur hébergé réussis ; publication à vérifier. La validation réelle précédente de la connexion historique utilise uniquement la commande fictive 9BD3D8F8 : un prospect, transmission en une tentative et retour automatique Confirmée ; aucune clé en clair n’a été récupérée ou publiée.

Updated 2026-10-18. This document describes an observed development state, not a production certification.

## Architecture
- Monorepo: Next.js frontend in `apps/web`, Express/TypeScript backend in `backend`, Prisma and MongoDB replica set.
- Development ports: frontend 3000, backend 4000, MongoDB 27017.
- Source code used during testing: `/Users/jobamafa/Downloads/imad_crm_phase01/candidates/phase08-20261017T115243Z-42791` (local Mac path; not portable).
- Backend Prisma schema: `backend/prisma/schema.prisma`.

## Earlier functional observations (2026-10-18; historical)
- Products collection: 11 ACTIVE products, of which 10 are labeled `[TEST 19A]`; these 10 have no images and no variants. Their test categories were all assigned to Bags. These are synthetic test records, not ready for commerce.
- `/api/products` returned HTTP 200 with 11 items; user confirmed catalog visibility subsequently.
- DeskcommCRM integration via encrypted config, order outbox, and periodic worker; observed TICK/ACTIVE markers at ~15-second spacing.
- Read-only outbox audit: 7 entries, 5 SENT and 2 old PENDING, no duplicate order IDs in outbox. Newest test order `6ad5036598784c2e0d8d032c` SENT with 1 attempt; user confirmed CRM receipt. CRM-side uniqueness remains to be independently checked.
- Historical PENDING records must not be replayed. Last confirmed launch cutoff: `2026-10-18T00:00:30.000Z`. Before starting a backend, verify its current configuration rather than assuming persistence.

## Safety
- Never commit secrets or user/customer data to Git.
- Do not execute `prisma db push` on the active MongoDB database; manually managed partial unique index for order idempotency may be affected.
- No automatic sending of old orders or webhooks; maintain explicit approval for live delivery tests.
- Every phase should emit a new, uniquely named TXT report, without overwriting prior reports.

## Git sync status

The synchronization and browser corrections were merged through PR #2 into Master on 2026-10-18. The corrected frontend was subsequently copied to the active local application with backups. Old preparation reports describing an unpushed candidate are historical.

## Synchronization follow-up — 2026-10-18

The prepared candidate was copied into an isolated workspace, compared with the local source, and corrected until the frontend production build and backend typecheck passed. No active runtime or database changes were applied. See CURRENT_STATUS.md for verification limits.

## Browser QA follow-up — 2026-10-18

Read-only browser testing used the existing API with an isolated frontend on port 3100. Fixed API access, mock homepage cart entries, missing standalone image rendering, contact navigation, checkout field labels and shipping mismatch. Test-only catalog records were retained. No successful checkout or CRM delivery was attempted. API_UPSTREAM_URL selects the same-origin proxy target at build time; defaults to the local API on port 4000. Explicit NEXT_PUBLIC_API_URL overrides the browser base URL and requires matching backend CORS configuration.

## Authorized checkout verification and subsequent audit — 2026-10-18

After explicit user authorization, one synthetic checkout was submitted. One local order, one outbox event sent on its first attempt, one CRM receipt and one pipeline lead were observed. The received reference, product, quantity and total matched. No forced replay or retry test was performed; historical pending entries remained unchanged. The synthetic order was retained as pending and reserved one unit of stock.

A later audit, documented in AUDIT_SITE_2026-10-18.md, identified 21 open findings and updated ROADMAP.md. Audit checks were read-only apart from a temporary browser cart addition that was removed. The audit did not implement the proposed application fixes. Dependency warnings are package-lock findings and require configuration-specific triage. Performance targets in the report are proposed acceptance criteria, not measured scores.

## Priority remediation (2026-10-18)

The ten P1 findings are implemented; see `docs/PRIORITY_FIXES_2026-10-18.md` and `docs/CURRENT_STATUS.md` for test evidence and operational limits. Dependency migration was explicitly authorized with backup and tests. Active demo/test fixtures are now DRAFT; optional `inventoryReserved` and `verifiedAt` fields preserve safe treatment of historical records. Never infer legacy stock reservations or reactivate unverified Telegram links.

## Usability and performance remediation (2026-10-18)

The remaining eleven audit items have been implemented and verified with twenty isolated scenarios and browser checks. See docs/USABILITY_PERFORMANCE_2026-10-18.md. Site content uses an explicit draft/publish/rollback collection; never publish guesses about commercial terms. Demo seeding is no longer a startup option and requires an isolated test database. Shared package runtime now uses compiled CommonJS output, built before the backend.
