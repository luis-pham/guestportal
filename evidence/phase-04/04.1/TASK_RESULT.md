# Task 04.1 — QR token model and lifecycle

## Result

**PASS**

## Dependency

Phase 03 gate `PASS`

## Delivered

- Migration `0007_locations_and_qr_codes.sql` — `locations` + `qr_codes` with RLS
- Opaque token mint (256-bit base64url) + SHA-256 hash lookup
- Admin APIs: list/create/patch(enable-disable + destination reassignment)/regenerate/download SVG|PNG
- Public `POST /v1/guest/resolve-qr` with identical safe failure for unknown/disabled/suspended
- In-process rate limit on resolve (30/min/IP)
- Admin UI `/operations/qr` (`QrCodesPanel`) — manage maps to `property.update` (docs `qr.manage` not yet in auth matrix)
- Locations endpoint now persists default lobby/guest_room rows (deterministic IDs compatible with preview)

## Tests

- contracts: `packages/contracts` qr suite — see `contracts-output.txt`
- unit: token entropy + rate-limit — see `unit-output.txt`
- integration: create/resolve/disable/download/permissions/cross-tenant/rate-limit — see `integration-output.txt`

## Acceptance

- [x] QR never exposes internal IDs
- [x] disabled and unknown tokens fail safely
- [x] token entropy and rate-limit tests
- [x] tenant/permission tests
- [x] disabled-token test

## Classification

**PASS**
