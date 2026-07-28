# Phase 10.3 Backup, Restore And Migration Runbook

Status: verified on VPS staging
Date: 2026-07-28

## Scope

This runbook covers PostgreSQL migration rehearsal, backup restore, and rollback rehearsal for GuestPortal. Redis is not treated as source of truth. R2 object versioning/lifecycle remains an infrastructure policy item outside this database drill.

## Required Tools

- `pg_dump`
- `pg_restore`
- `pnpm`
- A database owner URL with `CREATEDB` and role administration rights for production-like database-mode rehearsal.

On Ubuntu VPS staging, install the PostgreSQL client when missing:

```sh
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-client
```

## Pre-Migration Backup

Before a risky production migration:

```sh
pg_dump --format=custom --no-owner --no-privileges --file /secure/backups/guestportal-pre-migration.dump "$DATABASE_OWNER_URL"
```

Store the dump in the approved secure backup location. Do not store production dumps in the repository.

## Migration

Apply forward-only migrations:

```sh
pnpm --filter @guestportal/db db:migrate
```

Expected checks:

- `schema_migrations` includes every migration file in `packages/db/drizzle`.
- RLS remains enabled and forced on tenant tables.
- `guestportal_app` can connect to the target database.
- New indexes expected by the release are present.

## Restore Drill

For a restore rehearsal, restore into a new temporary database:

```sh
createdb guestportal_restore_drill
pg_restore --no-owner --no-privileges --dbname "$RESTORE_DATABASE_URL" /secure/backups/guestportal-pre-migration.dump
```

Then compare integrity:

- migration IDs
- core tenant row counts
- required indexes
- RLS flags
- application role connectivity

Drop temporary drill databases after evidence is captured.

## Rollback Rehearsal

GuestPortal database migrations are forward-only. Rollback means restoring the pre-upgrade backup into a replacement database, then repointing the application during the release procedure.

The rehearsal command proves this path:

```sh
pnpm --filter @guestportal/db db:rehearse-release
```

The command creates temporary databases, applies fresh and upgrade migrations, backs up pre/post upgrade states with `pg_dump`, restores with `pg_restore`, verifies integrity, and drops all temporary databases.

## Verified Command

```sh
set -a
source ./.env
set +a
pnpm --filter @guestportal/db db:migrate
pnpm --filter @guestportal/db db:rehearse-release
```

Evidence:

- `evidence/phase-10/10.3/backup-restore-rehearsal.json`
- `evidence/phase-10/10.3/logs/db-migrate.log`
- `evidence/phase-10/10.3/logs/backup-restore-rehearsal.log`
