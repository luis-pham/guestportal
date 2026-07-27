# Task 07.3 Voice Tool Bridge And Confirmation

Status: PASS
Date: 2026-07-27

## Scope

- Added Gemini Live tool declarations to the browser WebSocket setup.
- Mapped Gemini-safe function names such as `request_draft` to internal gateway tool names such as `request.draft`.
- Bridged Gemini `toolCall.functionCalls[]` to `POST /v1/guest/conversations/:conversationId/tool-results`.
- Sent Gemini `toolResponse.functionResponses[]` with the original function call `id` for correlation.
- Added guest UI confirmation cards for request/order drafts. Voice can create drafts only; the guest confirmation endpoints are called only after the guest presses Confirm.
- Added regression coverage for unsupported confirmation-like tool names, duplicate confirmation, and tenant/session isolation.

## Evidence

- `logs/guest-web-lint.log`
- `logs/guest-web-typecheck.log`
- `logs/guest-web-test.log`
- `logs/guest-web-build.log`
- `logs/guest-web-e2e-tool.log`
- `logs/api-lint.log`
- `logs/api-typecheck.log`
- `logs/api-unit-test.log`
- `logs/api-build.log`
- `logs/api-conversations-integration-local.log`
- `logs/ai-tools-lint.log`
- `logs/ai-tools-typecheck.log`
- `logs/ai-tools-test.log`
- `logs/ai-tools-build.log`
- `logs/client-secret-scan.log`
- `logs/vps-validation.log`
- `screenshots/voice-tool-confirmation-390.png`

## Local Validation

- `pnpm --filter @guestportal/guest-web lint`: PASS
- `pnpm --filter @guestportal/guest-web typecheck`: PASS
- `pnpm --filter @guestportal/guest-web test`: PASS, 3 files / 7 tests
- `pnpm --filter @guestportal/guest-web build`: PASS
- `pnpm --filter @guestportal/guest-web exec playwright test e2e/guest-voice-tool.spec.ts`: PASS
- `pnpm --filter @guestportal/api lint`: PASS
- `pnpm --filter @guestportal/api typecheck`: PASS
- `pnpm --filter @guestportal/api test`: PASS, 4 files / 4 tests
- `pnpm --filter @guestportal/api build`: PASS
- `pnpm --filter @guestportal/ai-tools lint`: PASS
- `pnpm --filter @guestportal/ai-tools typecheck`: PASS
- `pnpm --filter @guestportal/ai-tools test`: PASS, 1 file / 5 tests
- `pnpm --filter @guestportal/ai-tools build`: PASS
- Client secret scan over guest-web source and `.next`: PASS
- Local DB integration was skipped because `DATABASE_URL` was not set locally; real DB integration passed on VPS.

## VPS Validation

- Host project path: `/opt/apps/guestportal`
- Validated commit: `bedf5ef`
- Guest-web lint/typecheck/test/build: PASS
- API lint/typecheck/unit test/build: PASS
- AI-tools lint/typecheck/test/build: PASS
- Client secret scan over guest-web source, `.next/static`, and `.next/server`: PASS
- `pnpm --filter @guestportal/api exec vitest run src/conversations.integration.test.ts`: PASS, 1 file / 13 tests
- `GUEST_WEB_URL=http://127.0.0.1:3108 pnpm --filter @guestportal/guest-web exec playwright test e2e/guest-voice-tool.spec.ts`: PASS
- VPS repo restored to clean working tree after validation.

## Notes

- Real Gemini credential/audio verification remains reserved for Task 07.5; this task validates the tool bridge, correlation, and confirmation controls with deterministic browser/API tests.
