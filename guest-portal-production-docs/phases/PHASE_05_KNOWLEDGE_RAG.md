# Phase 05 — Knowledge Base and Multilingual RAG

## Scope

- R2 upload.
- Knowledge source.
- Parse PDF/DOCX/TXT/HTML.
- Language detect.
- Chunk.
- EmbeddingGemma.
- pgvector + FTS + pg_trgm.
- Search test UI.
- Source citation.
- Versioning.
- Missing-answer capture.

## Acceptance criteria

- Upload thực tế.
- Worker xử lý.
- Status rõ.
- Query khác ngôn ngữ tìm đúng source.
- Tenant/property filter.
- Failed ingestion recover/retry.
- Source update invalidates old chunks.
- Admin test retrieval UI VI/EN.

## Test bắt buộc

- Parser fixtures.
- Chunk unit.
- Embedding service integration.
- Hybrid retrieval benchmark.
- Cross-language query set.
- Tenant leakage.
- Prompt injection fixture.
- Worker retry/idempotency.
- UI screenshots.
- No-result/error states.

## Gate

Không PASS chỉ vì embedding endpoint trả vector; phải chứng minh retrieval end-to-end.
