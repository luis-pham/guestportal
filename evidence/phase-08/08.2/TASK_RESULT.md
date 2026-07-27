# Phase 08.2 - Catalog, Cart And Guest Submission

Status: PASS

Date: 2026-07-27

Scope note: the task allowlist names `apps/guest/**`; this repository's guest app is `apps/guest-web/**`, so guest UI work was implemented there.

Implemented:
- Guest catalog derived from published portal quick actions and promotion banner, with chat/map/navigation actions excluded from service submission.
- Guest request submission and order cart submission through draft create + confirm APIs.
- Guest-facing request/order list, detail, and cancel APIs.
- Status view backed by persisted guest requests/orders and surviving route reloads by reusing the active QR guest session.
- Mobile routes for `/services`, `/food`, and `/requests/[requestType]`.
- Duplicate order submission guard in the guest UI.

Verification:
- `pnpm --filter @guestportal/contracts test` - PASS, 28 tests.
- `pnpm --filter @guestportal/api test` - PASS, 9 tests.
- `pnpm --filter @guestportal/api test:integration -- src/request-orders.integration.test.ts` - PASS, 46 integration tests under the integration config.
- `pnpm --filter @guestportal/api typecheck` - PASS.
- `pnpm --filter @guestportal/api build` - PASS.
- `pnpm --filter @guestportal/guest-web typecheck` - PASS.
- `pnpm --filter @guestportal/guest-web lint` - PASS.
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 pnpm --filter @guestportal/guest-web build` - PASS.
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 GUEST_WEB_URL=http://127.0.0.1:3000 pnpm --filter @guestportal/guest-web exec playwright test e2e/guest-services.spec.ts` - PASS.
- Axe status report: 0 critical/serious violations.

Evidence:
- `evidence/phase-08/08.2/contracts-test.txt`
- `evidence/phase-08/08.2/api-unit-test.txt`
- `evidence/phase-08/08.2/request-orders-integration.txt`
- `evidence/phase-08/08.2/api-typecheck.txt`
- `evidence/phase-08/08.2/api-build.txt`
- `evidence/phase-08/08.2/guest-typecheck.txt`
- `evidence/phase-08/08.2/guest-lint.txt`
- `evidence/phase-08/08.2/guest-build.txt`
- `evidence/phase-08/08.2/guest-services-e2e.txt`
- `evidence/phase-08/08.2/axe-status.json`
- `evidence/phase-08/08.2/screenshots/services-320.png`
- `evidence/phase-08/08.2/screenshots/services-390.png`
- `evidence/phase-08/08.2/screenshots/services-430.png`
- `evidence/phase-08/08.2/screenshots/status-390.png`
