# Task 08.1 — Request and Order State Machines

Status: PASS
Completed at: 2026-07-27T23:14:00+07:00

## Scope

- Implemented explicit request state machine:
  `submitted -> accepted | rejected | cancelled`,
  `accepted -> in_progress | cancelled`,
  `in_progress -> completed | cancelled`.
- Implemented explicit order state machine:
  `submitted -> confirmed | cancelled`,
  `confirmed -> preparing | cancelled`,
  `preparing -> ready | cancelled`,
  `ready -> delivering | completed | cancelled`,
  `delivering -> completed | cancelled`.
- Added optimistic `version`, lifecycle timestamps, staff assignee, immutable order item/price snapshots, tenant-scoped status history, status outbox events and audit log records.
- Added staff transition endpoints for request/order lifecycle operations. Claim/assignment concurrency remains owned by Task 08.4.

## Evidence

- `contracts-test.txt`
- `api-unit-test.txt`
- `db-test.txt`
- `request-orders-integration.txt`
- `api-integration-full.txt`
- `typecheck.txt`

## Verification Summary

- Contracts: 9 files passed, 28 tests passed.
- API unit: 5 files passed, 9 tests passed.
- DB tests/live schema checks: 6 files passed, 12 tests passed.
- 08.1 integration: 1 file passed, 3 tests passed.
- Full API integration regression: 13 files passed, 44 tests passed.
- Typecheck: `@guestportal/contracts`, `@guestportal/db`, `@guestportal/api` passed.

## Acceptance Criteria

- Transitions explicit: PASS
- Invalid transitions rejected: PASS
- Optimistic version conflicts rejected: PASS
- Request/order transition writes are transactional: PASS
- Tenant/property scoped staff transition authorization: PASS
- Price/item snapshots immutable after order confirmation: PASS
- Audit/status history present: PASS

## Reserved Architecture Check

Reserved Architecture Check: PASS
Deferred decisions touched: none
Speculative commercial logic introduced: no
