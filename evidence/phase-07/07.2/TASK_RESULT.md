# Task 07.2 Browser Direct Voice Transport

Status: PASS
Date: 2026-07-27

## Scope

- Implemented browser-side Gemini Live transport in `apps/guest-web`, mapped from the task manifest path `apps/guest/**` because this repo's guest app is `apps/guest-web`.
- Browser requests microphone permission before minting a Live token.
- Browser creates an `AudioWorklet` lifecycle for microphone capture.
- Browser opens a direct Gemini Live WebSocket using the Phase 07.1 ephemeral token endpoint with `access_token`; backend does not proxy or relay audio.
- Guest chat screen now includes voice start/stop controls, voice lifecycle states, permission/error recovery, and text fallback via the existing guest conversation APIs.

## Evidence

- `logs/guest-web-lint.log`
- `logs/guest-web-typecheck.log`
- `logs/guest-web-test.log`
- `logs/guest-web-build.log`
- `logs/guest-web-e2e-mobile.log`
- `logs/client-secret-scan.log`
- `screenshots/voice-mobile-390.png`

## Local Validation

- `pnpm --filter @guestportal/guest-web lint`: PASS
- `pnpm --filter @guestportal/guest-web typecheck`: PASS
- `pnpm --filter @guestportal/guest-web test`: PASS, 3 files / 5 tests
- `pnpm --filter @guestportal/guest-web build`: PASS
- `pnpm --filter @guestportal/guest-web exec playwright test e2e/guest-voice.spec.ts`: PASS
- Client secret scan over `apps/guest-web/src` and `apps/guest-web/.next` excluding tests: PASS

## VPS Validation

- Host project path: `/opt/apps/guestportal`
- Validated commit: `c40f2b1`
- `pnpm --filter @guestportal/guest-web lint`: PASS
- `pnpm --filter @guestportal/guest-web typecheck`: PASS
- `pnpm --filter @guestportal/guest-web test`: PASS, 3 files / 5 tests
- `pnpm --filter @guestportal/guest-web build`: PASS
- Client secret scan over `apps/guest-web/src`, `.next/static`, and `.next/server` excluding tests: PASS
- `GUEST_WEB_URL=http://127.0.0.1:3107 pnpm --filter @guestportal/guest-web exec playwright test e2e/guest-voice.spec.ts`: PASS
- VPS repo restored to clean working tree after validation.

## Notes

- Real Gemini audio exchange is intentionally not claimed here; this task validates the browser direct transport shell, permission handling, AudioWorklet lifecycle, and WebSocket connection path. Real credential/audio validation remains under later Phase 07 gates.
