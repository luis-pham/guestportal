# Task 07.1 — Ephemeral token service

## Result

PASS

## Scope

- Added `POST /v1/guest/live-sessions` for scoped Gemini Live ephemeral token issuance.
- Added shared voice-live request/response contracts.
- Added Gemini Live token provisioning service using the official REST auth token endpoint.
- Enforced guest session authorization, active scoped conversation, one-use token request, short new-session TTL, session TTL, and rate limiting.
- Provider API key stays server-side and is not returned in API responses.

## External Integration Level

MOCK provider for 07.1 token endpoint tests. Real Gemini Live credential, direct browser WebSocket, microphone/audio, reconnect, and live tool call verification remain for later Phase 07 tasks, especially 07.5.

## Validation

- PASS `pnpm --filter @guestportal/contracts lint`
- PASS `pnpm --filter @guestportal/contracts typecheck`
- PASS `pnpm --filter @guestportal/contracts build`
- PASS `pnpm --filter @guestportal/contracts test`
- PASS `pnpm --filter @guestportal/api lint`
- PASS `pnpm --filter @guestportal/api typecheck`
- PASS `pnpm --filter @guestportal/api build`
- PASS `pnpm --filter @guestportal/api test`
- PASS targeted DB integration `src/voice-live.integration.test.ts`
- PASS client secret scan for Gemini provider key markers

## VPS Validation

Target: `/opt/apps/guestportal` on VPS.

- PASS contracts build/test
- PASS API lint/typecheck/build/unit
- PASS targeted DB integration `src/voice-live.integration.test.ts`
- PASS client secret scan for Gemini provider key markers

VPS log: `vps-validation.log`

## References

- Google Gemini ephemeral tokens documentation: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens

## Evidence

- `contracts-lint.log`
- `contracts-typecheck.log`
- `contracts-build.log`
- `contracts-test.log`
- `api-lint.log`
- `api-typecheck.log`
- `api-build.log`
- `api-test.log`
- `api-voice-live-integration.log`
- `client-secret-scan.log`
- `vps-validation.log`
