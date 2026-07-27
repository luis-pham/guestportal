# Task 05.6 — Knowledge Search Test UI and evidence

## Result

**PASS**

## Dependency

Task 05.5 `PASS`

## Delivered

- Admin Knowledge Search Test UI with query locale selection, sanitized-query status, scores, channels, source language, source titles and excerpts.
- Knowledge Sources UI recovery action for `uploaded` and `failed` sources via the real process endpoint.
- VI/EN copy for the search screen and process/retry controls.
- End-to-end evidence for real upload, object-store PUT, upload completion, knowledge source creation, processing, retrieval and citations.
- No-result and blocked-query states covered without fake retrieval.

## Tests / evidence

- Admin typecheck — `logs/admin-typecheck.log`
- Admin lint — `logs/admin-lint.log`
- Admin unit — `logs/admin-unit.log`
- DB build — `logs/build-db.log`
- API typecheck — `logs/api-typecheck.log`
- API build — `logs/build-api.log`
- Admin build — `logs/build-admin.log`
- DB migrate/seed — `logs/migrate.log`, `logs/seed.log`
- Admin E2E — `logs/admin-e2e.log` (`29 passed`)
- Axe report — `accessibility/knowledge-search-axe.json` (0 critical/serious violations)
- Visual screenshots — `screenshots/knowledge-search-{en,vi}-{1024,1280,1440}.png`
- Worker recovery/idempotency dependency evidence — `../05.2/ingestion-job-tests.txt`

## Acceptance

- [x] shows scores/sources/status
- [x] VI/EN complete
- [x] no fake retrieval
- [x] E2E upload/process/search
- [x] visual regression evidence
- [x] axe evidence
- [x] worker recovery evidence

## Scope notes

- The actual admin app path in this repo is `apps/admin-web/**`; task docs list `apps/admin/**`.
- `packages/db` exports the shared `Sql` type so API search code does not import `postgres` directly without an API package dependency.
- `@axe-core/playwright` was added to admin test dependencies for browser accessibility evidence.

## Classification

**PASS**
