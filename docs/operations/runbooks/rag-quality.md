# RAG Quality Runbook

1. Check no-result rate, retrieval latency, and ingestion backlog.
2. Verify affected query samples remain tenant-scoped and citation-safe.
3. Rebuild embeddings for affected sources only after checksum/version review.
4. Do not paste raw guest transcripts or source documents into shared logs.
