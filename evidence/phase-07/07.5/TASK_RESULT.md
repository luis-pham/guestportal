# Task 07.5 — Real Gemini Live verification

Status: PASS

Commit checked locally before evidence update: `ba18104`

## Summary

Real Gemini Live verification was run with a local `GEMINI_API_KEY=SET` credential and the currently supported Live model `models/gemini-3.1-flash-live-preview`.

The real-provider run created an ephemeral token, opened `BidiGenerateContentConstrained` over WebSocket, sent generated PCM audio, received input/output transcripts and audio output, verified the KB answer, received a real `request_draft` tool call, sent a tool response, and observed usage/session-resumption metadata.

Implementation fixes made during 07.5:

- Gemini auth token constraints now use `bidiGenerateContentSetup` plus `fieldMask`, matching the Live API reference.
- Gemini model IDs are normalized to `models/{model}` when the env value omits the prefix.
- Browser voice setup now uses `generationConfig.responseModalities`.
- Browser voice setup enables input/output audio transcription.
- Browser mic PCM chunks are streamed to Gemini as `realtimeInput.audio`.

## Evidence

- `logs/real-gemini-live-report.json`
  - label: `REAL_STAGING`
  - model: `models/gemini-3.1-flash-live-preview`
  - real ephemeral token: created and redacted
  - WebSocket endpoint: `BidiGenerateContentConstrained`
  - audio input transcript: `What time is the Aurora Hotel pool open?`
  - verified answer includes `06:00` and `22:00`
  - real tool call: `request_draft`
- `logs/real-gemini-live.log`
- `logs/real-gemini-live-transcript.log`
- `audio/pool-hours-16khz.wav`
- `audio/gemini-output-24khz.pcm`
- `screenshots/voice-mobile-390.png`

## Required checks

- Real credential audio test: PASS.
- Language samples: PASS, English audio and Vietnamese Live realtime input.
- Mobile browser smoke: PASS, Playwright mobile smoke captured screenshot.
- Video/screenshot evidence: PASS, screenshot captured; real provider audio artifacts captured.
- Real KB answer verified: PASS, pool hours answered as `06:00` to `22:00`.
- Real tool draft verified: PASS, Gemini called `request_draft` and the response kept draft confirmation semantics.
- Honesty gate obeyed: PASS, real-provider evidence is labeled `REAL_STAGING`; mocked mobile UI smoke is not labeled provider verification.

## Validation

- `pnpm --filter @guestportal/api lint`
- `pnpm --filter @guestportal/api typecheck`
- `pnpm --filter @guestportal/api test -- src/services/gemini-live.test.ts`
- `pnpm --filter @guestportal/api build`
- `NODE_ENV=test pnpm --filter @guestportal/api test:integration -- src/voice-live.integration.test.ts`
- `pnpm --filter @guestportal/guest-web lint`
- `pnpm --filter @guestportal/guest-web typecheck`
- `pnpm --filter @guestportal/guest-web test -- src/lib/voice-transport.test.ts`
- `pnpm --filter @guestportal/guest-web build`
- `pnpm --filter @guestportal/guest-web exec playwright test e2e/guest-voice.spec.ts`
- client bundle secret scan: PASS

## Environment Notes

- Local credential check is now `GEMINI_API_KEY=SET`.
- VPS credential check from the prior blocked evidence remains `GEMINI_API_KEY=UNSET`; VPS real-provider verification requires setting the same provider credential in `/opt/apps/guestportal/.env`.
- The local `.env` had an older `GEMINI_LIVE_MODEL` value during testing. The real verification command overrode it with `models/gemini-3.1-flash-live-preview`, and app code now normalizes missing `models/` prefixes.

## Reserved Architecture Check

Reserved Architecture Check: PASS
Deferred decisions touched: none
Speculative commercial logic introduced: no
