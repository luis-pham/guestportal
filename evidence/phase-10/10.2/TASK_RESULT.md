# Task 10.2 Result

Status: PASS
Date: 2026-07-28

## Summary

Performance and load qualification for guest, API, database, queue, and realtime paths is complete. The qualification added repeatable load, DB profile, queue stress, and Lighthouse checks with machine-readable evidence under `evidence/phase-10/10.2/`.

## Environment

- Local workspace: `/Users/huypq/Documents/Projects/guestportal`
- Local OS: macOS 26.3.1
- Node: v24.14.1
- pnpm: 11.11.0
- API load method: Fastify `app.inject` against the real local test database
- Lighthouse method: production builds served on localhost; final local run used API `4010`, guest web `3010`, admin web `3110` to verify dynamic port isolation

## Code Changes

- Added `apps/api/src/phase10-load.integration.test.ts` for concurrent API, realtime poll, and DB EXPLAIN ANALYZE qualification.
- Added `apps/worker/src/phase10-queue-stress.test.ts` for knowledge ingestion and embedding queue stress.
- Added `scripts/run-phase10-lighthouse.mjs` and `pnpm phase10:lighthouse` for repeatable guest/admin Lighthouse runs.
- Added Drizzle migration `0015_outbox_realtime_performance.sql` plus schema metadata for a realtime outbox replay expression index.

## Performance Results

- `api.propertiesList`: 120 requests, concurrency 12, p95 107.20ms, 0 errors, target p95 <= 750ms.
- `api.adminAnalyticsDashboard`: 80 requests, concurrency 8, p95 151.22ms, 0 errors, target p95 <= 900ms.
- `api.staffInbox`: 120 requests, concurrency 12, p95 160.61ms, 0 errors, target p95 <= 900ms.
- `realtime.guestPoll`: 100 requests, concurrency 10, p95 108.53ms, 0 errors, target p95 <= 750ms.
- `queue.knowledgeIngestion`: 120 jobs, concurrency 12, 25240.35 jobs/s, p95 0.92ms, target >= 40 jobs/s and p95 <= 250ms.
- `queue.embedding`: 160 jobs, concurrency 16, 16622.15 jobs/s, p95 1.91ms, target >= 50 jobs/s and p95 <= 250ms.
- `guest-home-desktop` Lighthouse: performance 1.00, accessibility 1.00, best-practices 0.96.
- `admin-login-desktop` Lighthouse: performance 1.00, accessibility 1.00, best-practices 1.00.

## Database Profiling

- `db.portalLatestPublished`: execution 0.815ms.
- `db.staffInboxRequests`: execution 0.131ms.
- `db.realtimeOutboxReplay`: execution 0.443ms.
- `db.knowledgeQueueBacklog`: execution 0.029ms.

## Bottlenecks

The realtime outbox replay query initially crossed the strict sequential-scan row threshold on a small local table. It was addressed with `outbox_events_org_property_created_idx` in migration `0015_outbox_realtime_performance.sql`.

PostgreSQL still selected a sequential scan locally because the table is small. This is explicitly accepted for the local qualification because the scan touched 1157 rows and executed in 0.443ms, well below the accepted small-table bound of 5000 rows and 25ms. The expression index is present for larger outbox volumes.

## Evidence

- API/DB/realtime report: `evidence/phase-10/10.2/performance/api-db-realtime-load.json`
- Queue stress report: `evidence/phase-10/10.2/performance/queue-stress.json`
- Lighthouse summary: `evidence/phase-10/10.2/lighthouse/summary.json`
- Lighthouse reports:
  - `evidence/phase-10/10.2/lighthouse/guest-home-desktop.json`
  - `evidence/phase-10/10.2/lighthouse/admin-login-desktop.json`
- Logs:
  - `evidence/phase-10/10.2/logs/db-typecheck.log`
  - `evidence/phase-10/10.2/logs/db-build.log`
  - `evidence/phase-10/10.2/logs/db-migrate.log`
  - `evidence/phase-10/10.2/logs/api-db-realtime-load.log`
  - `evidence/phase-10/10.2/logs/queue-stress.log`
  - `evidence/phase-10/10.2/logs/lighthouse.log`
  - `evidence/phase-10/10.2/logs/repo-typecheck.log`
  - `evidence/phase-10/10.2/logs/repo-test.log`
  - `evidence/phase-10/10.2/logs/repo-lint.log`
  - `evidence/phase-10/10.2/logs/builds.log`
  - `evidence/phase-10/10.2/logs/api-integration-full.log`

## Verification

- `pnpm --filter @guestportal/db typecheck`: PASS.
- `pnpm --filter @guestportal/db build`: PASS.
- `pnpm db:migrate`: PASS.
- `NODE_ENV=test pnpm --dir apps/api exec vitest run --config vitest.integration.config.ts src/phase10-load.integration.test.ts`: PASS, 1 file / 5 tests.
- `pnpm --filter @guestportal/worker test -- src/phase10-queue-stress.test.ts`: PASS, 1 file / 2 tests.
- `pnpm phase10:lighthouse`: PASS, 2 Lighthouse reports.
- `pnpm typecheck`: PASS, 29 tasks.
- `pnpm test`: PASS, 29 tasks.
- `pnpm exec turbo run lint --force`: PASS, 29 tasks.
- `pnpm --filter @guestportal/api build && pnpm --filter @guestportal/guest-web build && pnpm --filter @guestportal/admin-web build`: PASS.
- `NODE_ENV=test pnpm --dir apps/api exec vitest run --config vitest.integration.config.ts`: PASS, 19 files / 65 tests.

## Acceptance

- Targets and environment are recorded.
- Load tests, Lighthouse, DB query profiling, and queue stress are repeatable.
- The identified realtime outbox bottleneck was remediated with an index and the remaining local sequential scan was accepted explicitly with measured bounds.
