# Task 09.1 Result - Admin Operational Lists and Detail Views

## Summary

- Start commit: `296cf9c`
- End commit: final commit containing this report; see `git log -1 --oneline`.
- Status: PASS locally
- Scope: tenant-scoped admin request/order operations list, filters, cursor pagination, deep-linked detail views, permission checks, and evidence.

## Documents Read

- `guest-portal-production-docs/execution/00_EXECUTION_README.md`
- `guest-portal-production-docs/execution/01_PHASE_01_BASELINE_AND_TRANSITION.md`
- `guest-portal-production-docs/execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md`
- `guest-portal-production-docs/execution/03_IMPLEMENTATION_ORDER_AND_DEPENDENCIES.md`
- `guest-portal-production-docs/execution/04_TASK_EXECUTION_PROTOCOL.md`
- `guest-portal-production-docs/phases/PHASE_09_ADMIN_OPERATIONS_ANALYTICS.md`
- `guest-portal-production-docs/execution/tasks/09.1_admin_operational_lists_and_detail_views.md`
- `guest-portal-production-docs/execution/13_ROUTE_AND_NAVIGATION_MAP.md`
- `guest-portal-production-docs/execution/14_SCREEN_SPECIFICATIONS.md`
- `guest-portal-production-docs/execution/15_API_CONTRACTS.md`
- `guest-portal-production-docs/execution/17_PERMISSION_MATRIX.md`
- `guest-portal-production-docs/reserved/00_RESERVED_ARCHITECTURE.md`
- `guest-portal-production-docs/reserved/04_AGENT_CHECKLIST.md`

## Files Changed

- `packages/contracts/src/request-order.ts`
- `packages/contracts/src/request-order.test.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/services/request-orders.ts`
- `apps/api/src/routes/request-orders.ts`
- `apps/api/src/request-orders.integration.test.ts`
- `apps/admin-web/src/components/AdminOperationsPanel.tsx`
- `apps/admin-web/src/app/[locale]/page.tsx`
- `apps/admin-web/src/app/[locale]/layout.tsx`
- `apps/admin-web/src/styles/theme.css`
- `apps/admin-web/messages/en.json`
- `apps/admin-web/messages/vi.json`
- `apps/admin-web/e2e/admin-operations.spec.ts`
- `packages/ui/src/tokens.css`
- `packages/ui/src/tokens.ts`

## Implementation Notes

- Added admin operations contracts for list query/response, summary rows, request/order detail payloads, messages, and timeline entries.
- Added tenant-scoped API endpoints:
  - `GET /v1/admin/properties/:propertyId/operations/requests`
  - `GET /v1/admin/properties/:propertyId/operations/orders`
  - `GET /v1/admin/properties/:propertyId/operations/requests/:requestId`
  - `GET /v1/admin/properties/:propertyId/operations/orders/:orderId`
- List endpoints filter by status/date range and use cursor pagination on `(submitted_at, id)`.
- Admin UI now renders operational list, status/date filters, load-more pagination, and detail deep links for requests/orders.
- Added document title and slightly darkened muted text token to clear WCAG axe checks in the admin shell.
- No migrations required.

## Tests

- `pnpm --filter @guestportal/contracts test -- request-order.test.ts` - PASS, 29 tests across contracts package
- `pnpm --filter @guestportal/contracts build` - PASS
- `pnpm --filter @guestportal/api typecheck` - PASS
- `pnpm --filter @guestportal/api lint` - PASS
- `set -a; source ./.env; set +a; pnpm --filter @guestportal/api test:integration -- src/request-orders.integration.test.ts` - PASS, 14 files / 52 tests
- `pnpm --filter @guestportal/api build` - PASS
- `pnpm --filter @guestportal/admin-web typecheck` - PASS
- `pnpm --filter @guestportal/admin-web lint` - PASS
- `pnpm --filter @guestportal/admin-web test` - PASS, 4 tests
- `pnpm --filter @guestportal/admin-web build` - PASS
- `pnpm --filter @guestportal/ui test` - PASS, 28 tests
- `pnpm --filter @guestportal/ui typecheck` - PASS
- `pnpm --filter @guestportal/ui build` - PASS
- `set -a; source ./.env; set +a; node scripts/run-admin-e2e.mjs apps/admin-web/e2e/admin-operations.spec.ts` - PASS, 32 admin E2E tests

## Evidence

- `evidence/phase-09/09.1/screenshots/admin-operations-requests-1280.png`
- `evidence/phase-09/09.1/screenshots/admin-operations-orders-390.png`
- `evidence/phase-09/09.1/accessibility/axe-admin-operations-requests.json`
- `evidence/phase-09/09.1/UI_REVIEW.md`

## Acceptance Checklist

- Real dashboard/list data: PASS
- Property scoped operations endpoints: PASS
- Status/date filters: PASS
- Cursor pagination/load more: PASS
- Request/order detail deep links: PASS
- Permission E2E for unauthorized content manager: PASS
- Large-list pagination E2E: PASS
- Mobile and desktop visual evidence: PASS
- Axe serious/critical violations: PASS, none in 09.1 axe output

## Reserved Architecture Check

- Platform Admin, plans, billing, subscription, marketplace, and cross-tenant admin features were not implemented.
- Changes are tenant/property-scoped and use existing permission/authz paths.
- PASS.

## Notes

- Logical `apps/admin/**` task scope maps to actual repo path `apps/admin-web/**` per repository map.
- Existing execution plan markdown files were dirty before this task and were not modified or staged.
