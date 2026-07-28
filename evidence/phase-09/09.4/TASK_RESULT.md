# Task 09.4 — Export and audit log viewer

Result: PASS

## Commit

- Start commit: `75e9432e3fb12f6e17605cb6402d18181eaaa85b`
- End commit: this task commit

## Documents read

- `guest-portal-production-docs/execution/00_EXECUTION_README.md`
- `guest-portal-production-docs/execution/01_PHASE_01_BASELINE_AND_TRANSITION.md`
- `guest-portal-production-docs/execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md`
- `guest-portal-production-docs/execution/03_IMPLEMENTATION_ORDER_AND_DEPENDENCIES.md`
- `guest-portal-production-docs/execution/04_TASK_EXECUTION_PROTOCOL.md`
- `guest-portal-production-docs/execution/tasks/09.4_export_and_audit_log_viewer.md`
- `guest-portal-production-docs/phases/PHASE_09_ADMIN_OPERATIONS_ANALYTICS.md`
- `guest-portal-production-docs/07_SECURITY_PRIVACY.md`
- `guest-portal-production-docs/15_API_CONTRACTS.md`
- `guest-portal-production-docs/17_PERMISSION_MATRIX.md`
- `guest-portal-production-docs/reserved/00_RESERVED_ARCHITECTURE.md`
- `guest-portal-production-docs/reserved/04_AGENT_CHECKLIST.md`

## Files changed

- `packages/contracts/src/admin-audit.ts`
- `packages/contracts/src/admin-audit.test.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/services/admin-audit.ts`
- `apps/api/src/routes/admin-audit.ts`
- `apps/api/src/admin-audit.integration.test.ts`
- `apps/api/src/app.ts`
- `apps/admin-web/src/components/AdminAuditLogPanel.tsx`
- `apps/admin-web/src/components/AdminOperationsPanel.tsx`
- `apps/admin-web/src/app/[locale]/page.tsx`
- `apps/admin-web/src/lib/api.ts`
- `apps/admin-web/src/styles/theme.css`
- `apps/admin-web/messages/en.json`
- `apps/admin-web/messages/vi.json`
- `apps/admin-web/e2e/admin-audit.spec.ts`
- `evidence/phase-09/09.4/**`

## Migrations

- None. The existing Phase 01 `audit_logs` table is reused; no schema change was needed for the required viewer/export behavior.

## Implementation notes

- Added tenant-scoped audit log list API: `GET /v1/admin/organizations/:organizationId/audit-logs`.
- Added operation CSV export APIs: `GET /v1/admin/properties/:propertyId/operations/requests/export` and `GET /v1/admin/properties/:propertyId/operations/orders/export`.
- Export requires both queue read permission and `audit.read` on the property.
- CSV cells are quoted and formula-leading values are prefixed with `'`.
- Audit metadata is recursively redacted for token/password/secret/hash/key/cookie/credential-like fields.
- Audit viewer is read-only; no mutation route is exposed.

## Tests executed

- `pnpm --filter @guestportal/contracts test -- admin-audit.test.ts` — PASS, 12 files / 36 tests.
- `pnpm --filter @guestportal/contracts build` — PASS.
- `pnpm --filter @guestportal/api typecheck` — PASS.
- `set -a; source ./.env; set +a; pnpm --dir apps/api exec vitest run --config vitest.integration.config.ts src/admin-audit.integration.test.ts` — PASS, 1 file / 3 tests.
- `pnpm --filter @guestportal/admin-web typecheck` — PASS.
- `pnpm --filter @guestportal/admin-web lint` — PASS.
- `pnpm --filter @guestportal/api lint` — PASS.
- `pnpm --filter @guestportal/api build` — PASS.
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 pnpm --filter @guestportal/admin-web build` — PASS.
- `set -a; source ./.env; set +a; ADMIN_WEB_URL=http://127.0.0.1:3101 NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 NODE_ENV=production node scripts/run-admin-e2e.mjs apps/admin-web/e2e/admin-audit.spec.ts` — PASS, 39 admin E2E tests.
- `set -a; source ./.env; set +a; pnpm --filter @guestportal/api test:integration` — PASS, 17 files / 63 tests.

## Evidence

- `evidence/phase-09/09.4/accessibility/axe-admin-audit.json`
- `evidence/phase-09/09.4/screenshots/admin-audit-1280.png`
- `evidence/phase-09/09.4/screenshots/admin-audit-390.png`
- `evidence/phase-09/09.4/exports/guestportal-requests.csv`

## Acceptance checklist

- Export permission enforced: PASS
- CSV formula injection protected: PASS
- Large export behavior capped and surfaced with truncation headers: PASS
- Audit filters/search covered: PASS
- Exports scoped and escaped: PASS
- Audit immutable/read-only: PASS
- Sensitive fields protected: PASS
- Tenant scope preserved for org-wide and assigned-subset roles: PASS

## Scope exceptions

- `evidence/phase-09/09.4/**` was written for required task evidence.

## Known limitations

- CSV export is synchronous and capped at 5000 rows. Larger historical export jobs remain a future enhancement.
- Audit property scoping uses `metadata.propertyId` and property resource IDs because the existing audit table does not have a dedicated `property_id` column.

## Reserved architecture check

- Reserved Architecture Check: PASS
- Deferred decisions touched: none
- Speculative commercial logic introduced: no
