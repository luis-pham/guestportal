# Task 04.2 — Guest session and context resolution

## Result

**PASS**

## Dependency

Task 04.1 `PASS`

## Delivered

- Migration `0008_guest_sessions.sql` — privacy-conscious guest sessions + RLS
- `POST /v1/guest/sessions` — create from opaque QR token, HttpOnly `gp_guest_session` cookie, rate-limited
- `GET /v1/guest/session` — restore public property/location context from cookie (no QR token re-leak)
- Minimal metadata (`createdVia: qr` only; no PII)
- Guest web bootstrap at `/g/[qrToken]` (`apps/guest-web`)

## Tests

- contracts guest-session suite
- integration: create/get, malformed token, expiry, cross-org isolation — see `integration-output.txt`

## Acceptance

- [x] guest session is scoped
- [x] minimal data stored
- [x] no authentication assumption (QR + cookie only)

## Classification

**PASS**
