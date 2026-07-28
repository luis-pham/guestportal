# Phase 10.1 Threat Review

Status: PASS
Date: 2026-07-28

## Scope

- Secret exposure in tracked and untracked, non-ignored source files.
- Tenant isolation and IDOR coverage across guest, staff, admin, realtime, QR, upload, and audit surfaces.
- Abuse controls for rate-limited QR/voice token flows and upload constraints.
- R2/storage validation through upload integration and storage package tests.

## Findings

### S0/S1

None open.

### Remediated Findings

- Severity: S2
- Area: repository secret hygiene
- Finding: placeholder PostgreSQL URLs in `.env.example`, config tests, Drizzle config, and E2E runner fallbacks embedded a local password.
- Remediation: replaced tracked fallback URLs with no-password local URLs and kept real credentials delegated to environment variables.
- Verification: `pnpm security:secret-scan` produced `findingCount: 0`.

## Control Review

- Tenant isolation: covered by `tenant.integration.test.ts`, plus cross-tenant negative paths in request/order, realtime, conversation, QR, upload, and audit integration tests.
- IDOR: covered through request/order ownership checks, admin audit RBAC, guest session context checks, and tenant-scoped realtime subscriptions.
- Rate limits: covered by API unit tests and QR/voice integration paths.
- Upload abuse: covered by upload integration tests and storage package constraints for keys, limits, and configuration.
- Secrets: added `scripts/security-secret-scan.mjs` and root `security:secret-scan` script. Scanner checks candidate Git files, excluding binary/build/evidence log artifacts.

## External Integration Classification

- R2/upload: exercised through existing integration path using environment-backed test storage configuration and storage package constraints.
- Gemini Live: security-sensitive server token behavior covered by unit/integration tests, including server-side secret handling and rate-limit protections.

## Residual Risk

- No S0/S1 residual risk found for 10.1 scope.
- The scanner is intentionally regex-based and should remain a release gate companion, not the only production secret-control mechanism.
