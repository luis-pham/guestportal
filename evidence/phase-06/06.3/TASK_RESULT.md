# Task 06.3 — Draft request/order and confirmation protocol

## Result

**PASS**

## Dependency

Task 06.2 `PASS`

## Delivered

- Added request/order draft contracts, confirm contracts, and submitted request/order response contracts.
- Added draft-only AI tools:
  - `request.draft`
  - `order.draft`
- Kept direct confirmation out of the AI tool registry; commit actions require explicit guest confirmation endpoints.
- Added migration `0013_request_order_confirmation.sql` with:
  - `request_drafts`
  - `guest_requests`
  - `order_drafts`
  - `guest_orders`
  - tenant RLS policies
  - idempotency indexes
- Added guest confirmation endpoints:
  - `POST /v1/guest/request-drafts`
  - `POST /v1/guest/request-drafts/:draftId/confirm`
  - `POST /v1/guest/order-drafts`
  - `POST /v1/guest/order-drafts/:draftId/confirm`
- Confirm transactions commit the submitted row, draft state update, outbox event, and linked conversation transcript message together.

## Tests / evidence

- Contracts lint — `contracts-lint.log`
- Contracts typecheck — `contracts-typecheck.log`
- Contracts build — `contracts-build.log`
- Contracts test — `contracts-test.log` (`25 passed`)
- AI tools lint — `ai-tools-lint.log`
- AI tools typecheck — `ai-tools-typecheck.log`
- AI tools build — `ai-tools-build.log`
- AI tools test — `ai-tools-test.log` (`5 passed`)
- DB lint — `db-lint.log`
- DB typecheck — `db-typecheck.log`
- DB build — `db-build.log`
- DB migration — `db-migrate.log`
- DB test with live schema — `db-test.log` (`10 passed`)
- API lint — `api-lint.log`
- API typecheck — `api-typecheck.log`
- API build — `api-build.log`
- API integration — `api-integration.log` (`34 passed`)

## VPS validation

- Pulled commit `e6bce2a` into `/opt/apps/guestportal`.
- Applied migration `0013_request_order_confirmation.sql`.
- VPS validation passed:
  - `@guestportal/contracts`: lint, typecheck, build, tests (`25 passed`)
  - `@guestportal/db`: lint, typecheck, build, live schema tests (`10 passed`)
  - `@guestportal/ai-tools`: lint, typecheck, build, tests (`5 passed`)
  - `@guestportal/api`: lint, typecheck, build, full API integration (`11 passed`, `34 passed`)
- Restored test-generated `evidence/phase-05/05.5/retrieval-benchmark.json` side effect; VPS worktree returned clean.

## Acceptance

- [x] AI can create request/order drafts only.
- [x] AI cannot directly confirm/commit request or order tools.
- [x] Guest confirmation is required through explicit confirm endpoints.
- [x] Duplicate confirm with the same idempotency key returns the original committed row.
- [x] Expired drafts return `DRAFT_EXPIRED` and do not create submitted rows.
- [x] Cross-session draft confirmation returns `DRAFT_NOT_FOUND`.
- [x] Confirm transaction persists submitted row, outbox event, and transcript link together.
- [x] Request/order scope is derived from guest session and conversation ownership.

## Reserved Architecture Check

- Reserved Architecture Check: PASS
- Deferred decisions touched: none
- Speculative commercial logic introduced: no
- No plan, pricing, billing, payment, quota, subscription, or payment-provider logic was added.

## Scope notes

- Task-required evidence is stored under `evidence/phase-06/06.3/`.
- Full request/order staff state machines remain out of scope for Phase 08.
- Order drafts intentionally do not include price, tax, payment, or billing fields.

## Classification

**PASS**
