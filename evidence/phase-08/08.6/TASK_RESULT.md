# Task 08.6 - End-to-end operations evidence

Status: PASS
Date: 2026-07-28
Scope: Phase 08 request/order staff operations, guest status convergence, concurrency, realtime recovery, mobile UI evidence.

## Summary

Task 08.6 is complete. The evidence package proves guest-to-staff-to-guest operations through API integration tests and browser E2E tests:

- Full request lifecycle: guest creates/submits request, staff transitions status, history/audit/outbox are visible through API/UI assertions.
- Full order lifecycle: guest creates/submits order, staff inbox/detail shows item snapshots and staff can operate on assigned work.
- Claim race/concurrency: duplicate and competing claim paths return conflict/permission-safe outcomes; UI exposes the conflict state.
- Realtime recovery: staff inbox and guest status converge from realtime events and recover after reload/reconnect with dedupe.
- Mobile operation: screenshots cover guest services/status and staff inbox/detail/claim/realtime at mobile widths.
- VPS staff E2E exposed an async detail-load race where a stale detail response could overwrite the newly selected item. The race is fixed in `apps/staff-web/src/components/StaffOperationsWorkspace.tsx`, and the local full quality/integration plus staff/guest E2E were rerun after the fix.

## Commands

```bash
pnpm --filter @guestportal/api typecheck
pnpm --filter @guestportal/api lint
pnpm --filter @guestportal/api build
pnpm --filter @guestportal/staff-web typecheck
pnpm --filter @guestportal/staff-web lint
pnpm --filter @guestportal/staff-web test
pnpm --filter @guestportal/guest-web typecheck
pnpm --filter @guestportal/guest-web lint
pnpm --filter @guestportal/guest-web test
NODE_ENV=production pnpm --filter @guestportal/staff-web build
NODE_ENV=production pnpm --filter @guestportal/guest-web build
```

Result: PASS. Output: `logs/quality-build-unit.txt`

Post-fix rerun result: PASS. Output: `logs/quality-build-integration-after-race-fix.txt`

Final staff-only rerun result after the E2E wait stabilization: PASS. Output: `logs/staff-quality-final.txt`

```bash
pnpm --filter @guestportal/api test:integration -- src/request-orders.integration.test.ts src/realtime.integration.test.ts
```

Result: PASS. Output: `logs/api-integration-full.txt`

Observed result:

- API integration: 14 files passed, 51 tests passed.
- Request/order lifecycle suite: 8 tests passed.
- Realtime outbox suite: 2 tests passed.

```bash
node scripts/run-staff-e2e.mjs
```

Result: PASS. Output: `logs/staff-e2e.txt`

Post-fix rerun result: PASS. Output: `logs/staff-e2e-after-race-fix.txt`

Observed result:

- Staff E2E: 20 tests passed.
- Covered staff inbox/detail, loading/error/empty states, realtime inbox reload recovery, claim conflict visibility, staff property assignment restrictions, mobile shell, i18n overflow, and axe.

```bash
node scripts/run-guest-e2e.mjs
```

Result: PASS. Output: `logs/guest-e2e.txt`

Post-fix rerun result: PASS. Output: `logs/guest-e2e-after-race-fix.txt`

Observed result:

- Guest E2E: 8 tests passed.
- Covered brand home, navigation, catalog/cart/submission/status persistence, status empty/offline/slow states, realtime staff status convergence after reload, and voice regression paths.
- The guest E2E log includes the expected API server SIGTERM line after Playwright completes; the runner exit code was 0 and the test summary shows 8 passed.

## Evidence Files

Screenshots:

- `screenshots/guest-services-390.png`
- `screenshots/guest-status-390.png`
- `screenshots/guest-status-realtime-390.png`
- `screenshots/staff-inbox-en-390.png`
- `screenshots/staff-request-detail-vi-390.png`
- `screenshots/staff-order-detail-en-1280.png`
- `screenshots/staff-claim-conflict-390.png`
- `screenshots/staff-realtime-inbox-390.png`

Accessibility:

- `accessibility/axe-guest-status.json`: 0 violations
- `accessibility/axe-guest-realtime.json`: 0 violations
- `accessibility/axe-staff-ops.json`: 0 violations
- `accessibility/axe-staff-claim.json`: 0 violations
- `accessibility/axe-staff-realtime.json`: 0 violations

## Acceptance Checklist

- Full request E2E: PASS
- Full order E2E: PASS
- Claim race: PASS
- Realtime recovery: PASS
- Mobile screenshots: PASS
- UI complete, not DB-only: PASS
- Audit/status visible in covered workflows: PASS
- State transitions evidenced: PASS

## Notes

The first local integration attempt failed because the current sandbox blocked TCP access to local PostgreSQL on `localhost:5432`. A direct `psql` check outside the sandbox confirmed the seeded database, then the same integration command passed.
