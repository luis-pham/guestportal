# Phase 06 — Text Chat and AI Tool Gateway

## Scope

- Conversation.
- Messages.
- Text chat.
- RAG tool.
- Service/catalog tools.
- Draft request/order tools.
- Confirmation UI.
- Handoff shell.
- Translation.
- Transcript persistence policy.

## Acceptance criteria

- Text chat trả lời từ đúng KB.
- Có citation.
- Tool gateway validate.
- AI không mutation trực tiếp.
- Draft → guest confirm → commit.
- Idempotency.
- Error recovery.
- Multi-language.
- Chat history.

## Test bắt buộc

- Tool schema unit.
- Unauthorized tool call.
- Prompt injection.
- Duplicate confirm.
- RAG source correctness.
- E2E chat.
- VI/EN/KO sample.
- UI mobile screenshots.
- Network retry.
- Conversation isolation.

## Gate

Bất kỳ tool nào bypass confirmation hoặc tenant scope là FAIL.
