# Task 03.2 — R2 asset upload pipeline

## Result

**PASS**

## Dependency

Task 03.1 `PASS`

## Architecture

- Cloudflare R2 is the canonical object storage provider.
- MinIO/Docker are not required and were not used.
- Provider evidence label: `REAL_STAGING`

## Implemented

| Area | Output |
|---|---|
| `packages/storage` | R2 client (S3-compatible API), presign PUT/GET, head/get/delete, key builders, image constraints |
| `packages/db` | `assets` table + RLS (`0004_assets.sql`) |
| `packages/contracts` | `uploadPresignRequestSchema` / `uploadCompleteRequestSchema` |
| `apps/api` | `POST /v1/uploads/presign`, `POST /v1/uploads/complete`, `GET/DELETE /v1/assets/:assetId` |
| `apps/admin-web` | Branding logo/cover upload UI with progress + error states |

## Acceptance criteria

| Criterion | Status |
|---|---|
| No AWS S3 product dependency (R2 via S3-compatible API only) | PASS |
| No R2 secrets in browser (presigned URLs only) | PASS |
| Cross-tenant asset access denied | PASS (nomad owner → 403) |
| Real R2 staging verification | PASS |
| Unauthorized / content-type / size tests | PASS |
| Failed upload E2E | PASS |

## REAL_STAGING verification checklist

- [x] Upload disposable object under `test/task-03-2/`
- [x] Confirm object exists (HEAD)
- [x] Confirm content-type and cache headers
- [x] Confirm generated public URL shape (`ASSETS_PUBLIC_BASE_URL` + key)
- [x] Read uploaded object (GetObject + signed GET)
- [x] Delete object and confirm deletion
- [x] Tenant/property key isolation (`org/{orgId}/property/{propertyId}/...`)
- [x] Invalid/missing configuration fails clearly
- [x] Cleanup of test objects

## Evidence

- `commands.log`
- `migrate.log`
- `unit-storage.log` / `unit-contracts.log`
- `r2-staging.log` / `cmd-test_r2_staging.log`
- `api-integration.log`
- `admin-e2e.log`

## Known limitations

1. R2 API token lacks `PutBucketCors`. Browser direct PUT from Admin requires CORS rules on the bucket configured in the Cloudflare dashboard for `http://localhost:3101` / production admin origin (`AllowedMethods: PUT,GET,HEAD`, `AllowedHeaders: *`).
2. Public custom domain fetch may return 403/404 until CDN/public access is fully bound; authenticated GetObject/signed GET are the authoritative read checks and passed.

## Reserved architecture check

PASS — no Platform Admin, billing, plans, subscriptions, marketplace, or CRM work.

## Classification

**PASS**
