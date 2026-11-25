## Sauvegarde chiffrée hors serveur — 25 novembre 2026

Outil scripts/offsite-recovery.py : archive age incluant dump PostgreSQL, photos, profils privés, code compatible et inventaire facultatif des droits ; clé secrète séparée. Recette sur un nouveau cluster local sans écoute TCP, sans profil exécuté ni worker. Manifestes et photos vérifiés, toutes les tables et séquences empreintées, références photos et déchiffrement des réglages contrôlés ; cluster arrêté puis copies claires supprimées. Échec d’arrêt : conserver la copie privée pour examen. Aucune restauration sur la base active. Guide docs/RECOVERY_OPERATIONS.md ; données fictives exclusivement en CI. La copie ponctuelle DATA n’est pas une sauvegarde cloud automatique ; destination durable, rétention, surveillance et clé de récupération indépendante à convenir avant une offre de service. Preuves privées : outputs/offsite-recovery-20261125 sur DATA.

## Personnalisation publique — 25 novembre 2026

Section Paramètres → Identité de la boutique : nom, logos clair/sombre importés, couleurs principale/accent/fond et coordonnées publiques, aperçu privé et publication explicite. Valeurs par défaut IMAD conservées sans surcharge de palette ; distinction entre e-mail public, SMTP et identité juridique. Écriture protégée par settings.manage et révision atomique, relecture après réponse perdue. Migration additive 20261125190000_store_branding : nouvelle table seule, aucun enregistrement initial. Les commandes, paiements, stock, photos, transporteur, CRM, Pixel et comptes MFA restent inchangés. Guide docs/STORE_BRANDING.md. Tests/publication suivis sur DATA dans outputs/store-branding-20261125.

# Imad Store — AI Development Guide

The Git repository is the source of truth for code and checked-in project context. Read `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATUS.md`, and `docs/ROADMAP.md` before work. Verify state against actual code and tests; these documents may be stale.

Never commit `.env*`, secrets, customer information, backups, MongoDB dumps, unredacted reports, or generated build artifacts. No destructive database operations or `prisma db push` on the active MongoDB database. Treat webhook delivery as a real external action. Do not create or resend orders without explicit consent, and preserve historical outbox cutoff. Prefer audit → candidate → backup → tests → explicit apply → rollback, with a unique TXT report for each script run. The local source path is deployment-specific and is not a portable repository path.
