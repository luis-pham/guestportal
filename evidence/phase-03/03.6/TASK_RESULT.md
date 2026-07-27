# Task 03.6 — Publish, immutable versions and rollback

## Result

**PASS**

## Dependency

Task 03.5 `PASS`

## Implemented

| Area | Output |
|---|---|
| `packages/db` | `portal_versions` (immutable) + `outbox_events` (`0006_portal_versions.sql`) |
| `packages/contracts` | Publish/restore request schemas |
| `apps/api` | `POST .../publish`, `GET .../versions`, `POST .../versions/:id/restore` with idempotency + `portal.published` outbox |
| `apps/admin-web` | Publish history UI with publish + restore |

## Acceptance criteria

| Criterion | Status |
|---|---|
| Published versions cannot mutate | PASS (new row only; restore creates new version) |
| Concurrent publish handled | PASS (draft version conflict 409) |
| Rollback auditable | PASS (restoredFromVersionId + audit + outbox) |

## Tests

- API integration: 14 passed (includes portal-publish.integration.test.ts)
- Admin e2e: 25 passed (includes publish/rollback)

## Classification

**PASS**
