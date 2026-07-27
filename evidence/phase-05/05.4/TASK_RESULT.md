# Task 05.4 — EmbeddingGemma indexing pipeline

## Result

**PASS**

## Dependency

Task 05.3 `PASS`

## Scope note

`apps/embedding-service/**` was a Phase 00 stub (`ready: false`). Touched to expose `POST /v1/embeddings` so the worker/RAG pipeline can enforce the EmbeddingGemma **768-d contract**. Current backend is stable hashed n-grams (swap-compatible with model weights later).

## Delivered

- Embedding service: `/v1/model` ready + `/v1/embeddings` (single-org batches, exact 768-d L2 vectors)
- `@guestportal/rag` embedding client with dimension + tenant batch validation + `toPgVectorLiteral`
- Worker `runEmbeddingJob` with idempotency key replay and observable `queued|processing|ready|failed` state
- Migration `0011_knowledge_chunk_embedding_hnsw.sql` — partial HNSW cosine index on active embeddings

## Tests / evidence

- Python embedding service — `test-embed-py.log` (6 passed)
- Dimension/client unit — `test-rag.log` (13 passed)
- HNSW index migration + live index — `test-db.log` (6 passed)
- Idempotent embedding job — `test-worker.log` (6 passed)

## Acceptance

- [x] exact dimension enforced (768)
- [x] no cross-tenant batch mix (org required per request; response org checked)
- [x] job state observable (`getEmbeddingJobState` / result.state)

## Classification

**PASS**
