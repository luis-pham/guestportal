# Task 05.2 — Document parsing and normalization

## Result

**PASS**

## Dependency

Task 05.1 `PASS`

## Delivered

- Package `@guestportal/rag` with parsers for TXT/MD, HTML, PDF (`pdfjs-dist`), DOCX (`mammoth`)
- Normalized document contract (`normalizedDocumentSchema`) with provenance checksum, parser, parserVersion, extractedAt
- HTML script/style stripping with warnings
- Empty/unsupported mime → recoverable `ParseError` codes (`EMPTY_DOCUMENT`, `UNSUPPORTED_MIME`, `PARSE_FAILED`)
- Worker `runKnowledgeIngestionJob` with idempotency-key replay for `knowledge-ingestion` queue
- Fixtures: `packages/rag/fixtures/sample.{txt,html,pdf,docx}`

## Tests / evidence

- Parser fixtures + malformed — `parser-tests.txt` (6 passed)
- Idempotent ingestion job — `ingestion-job-tests.txt` (3 passed incl. queues)
- Worker build — `worker-build.txt`

## Acceptance

- [x] provenance retained
- [x] failures recoverable
- [x] no silent text loss (empty docs fail explicitly)

## Classification

**PASS**
