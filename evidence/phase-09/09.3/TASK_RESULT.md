# Task 09.3 - Analytics Queries And Dashboard

## Result

Implemented tenant-scoped admin analytics for the selected property:

- Added `@guestportal/analytics` query package for dashboard aggregates.
- Added contracts for analytics query and dashboard response validation.
- Added `GET /v1/admin/properties/:propertyId/analytics` with `analytics.read` authorization.
- Added admin analytics dashboard with date filters, summary KPIs, daily activity, status mix, and top services.
- Added EN/VI messages and wired `/properties/:propertyId/analytics`, `/analytics/operations`, and `/analytics/ai` to the real dashboard.
- Added integration coverage for aggregation, timezone boundaries, tenant leakage, permission denial, and required indexes.
- Added Playwright coverage for real seeded data, permission error, screenshots, mobile overflow, and axe accessibility.

## Notes

QR analytics uses the current cumulative `qr_codes.scan_count` plus the count of QR codes scanned in the requested date range via `last_scanned_at`. The current schema does not store per-scan events, so historical scan-by-day rollups require a future migration/event table.

## Local Verification

- `pnpm --filter @guestportal/contracts test -- analytics.test.ts`
- `pnpm --filter @guestportal/contracts build`
- `pnpm --filter @guestportal/analytics typecheck`
- `pnpm --filter @guestportal/analytics lint`
- `pnpm --filter @guestportal/analytics build`
- `pnpm --filter @guestportal/api typecheck`
- `pnpm --filter @guestportal/api lint`
- `pnpm --filter @guestportal/api build`
- `pnpm --filter @guestportal/admin-web typecheck`
- `pnpm --filter @guestportal/admin-web lint`
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 pnpm --filter @guestportal/admin-web build`
- `set -a; source ./.env; set +a; pnpm --dir apps/api exec vitest run --config vitest.integration.config.ts src/analytics.integration.test.ts`
- `set -a; source ./.env; set +a; ADMIN_WEB_URL=http://127.0.0.1:3101 NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 NODE_ENV=production node scripts/run-admin-e2e.mjs apps/admin-web/e2e/admin-analytics.spec.ts`
- `set -a; source ./.env; set +a; pnpm --filter @guestportal/api test:integration` - 16 files / 60 tests passed.
- `set -a; source ./.env; set +a; ADMIN_WEB_URL=http://127.0.0.1:3101 NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 NODE_ENV=production node scripts/run-admin-e2e.mjs apps/admin-web/e2e/admin-analytics.spec.ts` - 37 admin E2E tests passed.

## Evidence

- `evidence/phase-09/09.3/accessibility/axe-admin-analytics.json`
- `evidence/phase-09/09.3/screenshots/admin-analytics-1280.png`
- `evidence/phase-09/09.3/screenshots/admin-analytics-390.png`
