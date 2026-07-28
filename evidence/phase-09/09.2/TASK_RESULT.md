# Task 09.2 — Staff, settings and knowledge operations

Status: PASS

## Summary

- Added tenant-scoped admin team member APIs for list/update/revoke with `team.read` / `team.manage`, property assignment validation, audit logging, property-manager scoped list filtering and last active owner protection.
- Added organization settings contract validation and security settings read endpoint.
- Added knowledge source publish, unpublish and delete operations with permission checks, confirmation requirements for dangerous actions and audit logging.
- Added admin UI panels for Team members, Invitations empty state, Organization settings, Security controls, and expanded Knowledge Sources filters/actions.
- Completed EN/VI copy for all new admin operations surfaces.

## Evidence

- Accessibility: `evidence/phase-09/09.2/accessibility/axe-admin-team.json`
- Screenshots:
  - `evidence/phase-09/09.2/screenshots/admin-team-1280.png`
  - `evidence/phase-09/09.2/screenshots/admin-invitations-390.png`
- E2E coverage: `apps/admin-web/e2e/admin-management.spec.ts`
- API integration coverage: `apps/api/src/admin-operations.integration.test.ts`
- Contract coverage: `packages/contracts/src/admin-operations.test.ts`

## Verification

- `pnpm --filter @guestportal/contracts test -- admin-operations.test.ts` — PASS, 10 files / 31 tests.
- `pnpm --filter @guestportal/contracts build` — PASS.
- `pnpm --filter @guestportal/api typecheck` — PASS.
- `pnpm --filter @guestportal/api lint` — PASS.
- `set -a; source ./.env; set +a; pnpm --filter @guestportal/api test:integration -- src/admin-operations.integration.test.ts` — PASS, 15 files / 56 tests.
- `pnpm --filter @guestportal/api build` — PASS.
- `pnpm --filter @guestportal/admin-web typecheck` — PASS.
- `pnpm --filter @guestportal/admin-web lint` — PASS.
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 pnpm --filter @guestportal/admin-web build` — PASS.
- `set -a; source ./.env; set +a; ADMIN_WEB_URL=http://127.0.0.1:3101 NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 NODE_ENV=production node scripts/run-admin-e2e.mjs apps/admin-web/e2e/admin-management.spec.ts` — PASS, 35 admin E2E tests.

## Notes

- Invitation persistence is not implemented because Task 09.2 allowed paths exclude `packages/db/**` and the current schema has no invitation table. The UI exposes a truthful empty state instead of creating speculative storage.
- The admin E2E runner executes the full admin suite even when a specific spec path is supplied.

## Reserved Architecture Check

Reserved Architecture Check: PASS
Deferred decisions touched: none
Speculative commercial logic introduced: no

## Result

PASS
