# Phase 07 — Gemini Live Native Audio

## Scope

- Ephemeral token endpoint.
- Browser direct connection.
- Microphone permission.
- AudioWorklet.
- Voice controls.
- Auto language detection.
- Tool gateway bridge.
- Transcript.
- Interrupt/reconnect.
- Text fallback.
- Usage metrics.

## Acceptance criteria

- API key không xuất hiện client bundle.
- Audio không relay qua backend.
- Ephemeral token TTL/scope.
- Voice hỏi KB và nhận đúng câu trả lời.
- Voice tạo request/order draft.
- Guest xác nhận trước commit.
- Reconnect hợp lý.
- Permission denied UI.
- Text fallback.

## Test bắt buộc

- Secret scan client bundle.
- Token expiry.
- Browser permission denied.
- Real integration test khi có credential.
- Tool call end-to-end.
- Language samples.
- Network interruption.
- Mobile browser smoke.
- Latency metrics.
- Screenshot/video evidence.

## Honesty gate

Nếu không có Gemini credential hoặc không chạy được audio thật, phase phải `BLOCKED`, không được PASS.
