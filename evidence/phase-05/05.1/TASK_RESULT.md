# Task 05.1 — Knowledge source and upload lifecycle

## Result

**PASS**

## Dependency

Phase 04 gate `PASS`

## Delivered

- Migration `0009_knowledge_sources.sql` + RLS
- Upload purpose `knowledge_source` (PDF/DOCX/TXT/HTML/MD, 25MB, private visibility)
- APIs: list/create/get/patch knowledge-sources; status `draft` → `pending_upload` → `uploaded` / `failed`
- Admin `KnowledgeSourcesPanel` at `/properties/:id/knowledge`
- Permission: `knowledge.create` / `knowledge.read`

## Tests / evidence

- storage constraint unit tests
- integration REAL_STAGING R2 upload + tenant denial — `integration-output.txt`
- failure UI E2E (unsupported mime) — `e2e-output.txt`, `screenshots/knowledge-upload-failure-1280.png`

## Acceptance

- [x] real files accepted
- [x] status is observable
- [x] cross-tenant access denied

## Classification

**PASS**
