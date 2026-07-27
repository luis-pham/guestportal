# Task 05.3 — Chunking, language detection and versioning

## Result

**PASS**

## Dependency

Task 05.2 `PASS`

## Delivered

- Deterministic chunker (`CHUNKER_VERSION=1.0.0`) with target/overlap packing and content hashes
- Lightweight language detection for VI/EN/KO/JA/ZH/FR
- Migration `0010_knowledge_chunks.sql`: chunks + FTS (`content_tsv`) + `pg_trgm` + nullable `vector(768)` embedding + RLS
- Source fields: `parser_version`, `embedding_model`, `embedding_model_version`
- Worker `ChunkVersionStore.replaceFromParsedDocument` invalidates prior active chunks on re-ingest

## Tests / evidence

- Chunk + language fixtures — `test-rag.log` (10 passed)
- Migration SQL + live schema/extensions — `test-db.log` (4 passed)
- Version invalidation — `test-worker.log` (4 passed)

## Acceptance

- [x] deterministic chunks
- [x] old active chunks invalidated
- [x] metadata complete (language, headingPath, chunkerVersion, contentHash, ordinal)

## Classification

**PASS**
