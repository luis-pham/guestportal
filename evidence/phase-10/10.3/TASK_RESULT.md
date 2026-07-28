# Task 10.3 Result

Status: PASS
Date: 2026-07-28

## Summary

Backup, restore, and migration rehearsal is complete on the VPS staging environment. The rehearsal used real PostgreSQL temporary databases, `pg_dump`, and `pg_restore`; verified fresh migration, upgrade migration, backup restore, rollback restore, RLS flags, migration IDs, indexes, table counts, and application role connectivity; then dropped all temporary databases.

## Code Changes

- Added `packages/db/src/release-rehearsal.ts`.
- Added `pnpm --filter @guestportal/db db:rehearse-release`.
- Added migration `0016_app_role_current_database_grant.sql` so `guestportal_app` is granted `CONNECT` on the active target database during fresh/staging rehearsals.
- Added `evidence/phase-10/10.3/RUNBOOK.md`.

## Environment

- VPS path: `/opt/apps/guestportal`
- Source database under rehearsal: `guestportal`
- Rehearsal mode: temporary database mode
- PostgreSQL client: 16.14
- Commit under VPS test: `9d0f5e7`

Local note: the local database user is not permitted to create databases or alter roles, so local verification covered DB lint/typecheck/tests. The production-like backup/restore drill was run on the VPS database owner connection.

## Evidence

- Machine report: `evidence/phase-10/10.3/backup-restore-rehearsal.json`
- Runbook: `evidence/phase-10/10.3/RUNBOOK.md`
- Logs:
  - `evidence/phase-10/10.3/logs/db-migrate.log`
  - `evidence/phase-10/10.3/logs/backup-restore-rehearsal.log`
  - `evidence/phase-10/10.3/logs/db-build.log`
  - `evidence/phase-10/10.3/logs/db-lint.log`
  - `evidence/phase-10/10.3/logs/db-typecheck.log`
  - `evidence/phase-10/10.3/logs/db-test.log`
  - `evidence/phase-10/10.3/logs/repo-lint.log`
  - `evidence/phase-10/10.3/logs/repo-typecheck.log`
  - `evidence/phase-10/10.3/logs/repo-test.log`

## Rehearsal Result

- Fresh migration: PASS, 17 migrations applied through `0016_app_role_current_database_grant.sql`.
- Upgrade migration: PASS, upgraded from 16 prior migrations to 17 migrations with fixture data intact.
- Backup restore: PASS, restored post-upgrade dump into a temporary database and matched migration IDs/table counts.
- Rollback rehearsal: PASS, restored pre-upgrade dump into a temporary database and confirmed the latest migration was absent.
- Cleanup: PASS, no `guestportal_%` temporary databases remained on VPS after the drill.

## Verification

- `pnpm --filter @guestportal/db build`: PASS.
- `pnpm --filter @guestportal/db lint`: PASS.
- `pnpm --filter @guestportal/db typecheck`: PASS.
- `pnpm --filter @guestportal/db test`: PASS, 6 files / 7 passed / 5 skipped.
- `pnpm exec turbo run lint --force`: PASS, 29 tasks.
- `pnpm typecheck`: PASS, 29 tasks.
- `pnpm test`: PASS, 29 tasks.
- VPS `pnpm --filter @guestportal/db db:migrate`: PASS.
- VPS `pnpm --filter @guestportal/db db:rehearse-release`: PASS.
- VPS temp database cleanup query: PASS, returned `[]`.

## Reserved Architecture Check

Reserved Architecture Check: PASS
Deferred decisions touched: none
Speculative commercial logic introduced: no

## Acceptance

- Restore drill succeeds.
- Data integrity is checked.
- Runbook is accurate for the verified procedure.
