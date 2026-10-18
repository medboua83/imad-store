# Imad Store — AI Development Guide

The Git repository is the source of truth for code and checked-in project context. Read `docs/PROJECT_MEMORY.md`, `docs/CURRENT_STATUS.md`, and `docs/ROADMAP.md` before work. Verify state against actual code and tests; these documents may be stale.

Never commit `.env*`, secrets, customer information, backups, MongoDB dumps, unredacted reports, or generated build artifacts. No destructive database operations or `prisma db push` on the active MongoDB database. Treat webhook delivery as a real external action. Do not create or resend orders without explicit consent, and preserve historical outbox cutoff. Prefer audit → candidate → backup → tests → explicit apply → rollback, with a unique TXT report for each script run. The local source path is deployment-specific and is not a portable repository path.
