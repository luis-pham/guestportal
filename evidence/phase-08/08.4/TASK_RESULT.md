# Task 08.4 — Claim, Assignment and Concurrency

Result: PASS

## Summary

- Added atomic staff claim endpoints:
  - `POST /v1/staff/requests/:requestId/claim`
  - `POST /v1/staff/orders/:orderId/claim`
- Claim uses conditional update on `assigned_staff_id IS NULL` and `version`.
- Claim writes `staff.assignment_changed.v1` outbox events and audit rows.
- Existing staff status transitions now reject non-assignee mutations with `409 ALREADY_CLAIMED`.
- Staff UI claim button is enabled and shows success/conflict/error notices.
- UI conflict state is covered by two-worker Playwright E2E.

## Scope Notes

- Task manifest lists `apps/staff/**`; actual repository mapping is `apps/staff-web/**` per `execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md`.
- No migration was required; Phase 08.1 already added `assigned_staff_id`, lifecycle `version`, audit, history and outbox foundations.

## Required Tests

- Two-worker claim race: PASS
- Optimistic concurrency: PASS
- Permission tests: PASS
- UI conflict E2E: PASS

## Evidence

- API integration output: `evidence/phase-08/08.4/request-orders-claim-integration.txt`
  - `13 passed (13)`
  - `49 passed (49)`
- Staff E2E output: `evidence/phase-08/08.4/staff-claim-e2e.txt`
  - `19 passed`
  - Includes `staff claim conflict is visible when another worker claims first`
- Accessibility: `evidence/phase-08/08.4/axe-staff-claim.json`
  - `violations: []`
- Screenshot: `evidence/phase-08/08.4/screenshots/staff-claim-conflict-390.png`

## Additional Local Verification

- `pnpm --filter @guestportal/contracts test`: PASS, 28 tests
- `pnpm --filter @guestportal/contracts lint`: PASS
- `pnpm --filter @guestportal/contracts typecheck`: PASS
- `pnpm --filter @guestportal/contracts build`: PASS
- `pnpm --filter @guestportal/api typecheck`: PASS
- `pnpm --filter @guestportal/api lint`: PASS
- `pnpm --filter @guestportal/api build`: PASS
- `pnpm --filter @guestportal/staff-web typecheck`: PASS
- `pnpm --filter @guestportal/staff-web lint`: PASS
- `pnpm --filter @guestportal/staff-web test`: PASS, 5 tests
- `NODE_ENV=production pnpm --filter @guestportal/staff-web build`: PASS

## UI Review

- Mobile 390px claim conflict banner is visible and readable.
- No horizontal overflow detected in the E2E conflict scenario.
- Full-page screenshot is long because the shared local integration database contains accumulated submitted work from repeated E2E seeds.

## Reserved Architecture Check

Reserved Architecture Check: PASS
Deferred decisions touched: none
Speculative commercial logic introduced: no

