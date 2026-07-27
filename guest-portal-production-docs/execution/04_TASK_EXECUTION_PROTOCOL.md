# Task Execution Protocol

## Before editing

1. Confirm the current task ID.
2. Check every dependency result.
3. Read `reserved/00_RESERVED_ARCHITECTURE.md` and `reserved/04_AGENT_CHECKLIST.md`, then read only the task-listed documents.
4. Produce or update the Phase 01 baseline report when starting Phase 02.
5. Inspect existing implementation in allowed paths.
6. Record assumptions and discovered deviations.

## During implementation

- Keep changes inside allowed paths.
- Use existing architecture and naming.
- Add or update contracts before implementations that consume them.
- Add tests with production code, not afterward.
- Preserve tenant metadata at every persistence and retrieval boundary.
- No fake data in production flows.
- No `TODO` that bypasses acceptance criteria.

## Required task report

Write `evidence/<phase>/<task-id>/TASK_RESULT.md` with:

- task ID and title;
- start/end commit SHA when available;
- documents read;
- files changed;
- migrations created;
- tests executed with exact commands;
- evidence paths;
- acceptance checklist;
- scope exceptions;
- known limitations;
- reserved architecture check and deferred decisions touched;
- result: PASS, FAIL or BLOCKED.

## UI tasks

UI tasks additionally require screenshots for every viewport listed in the manifest, loading/empty/error states where applicable, axe output and a manual visual-review checklist.

## Backend tasks

Backend tasks additionally require contract tests, tenant-isolation tests, failure-path tests and migration rollback/rehearsal when schema changes.

## Stop rule

After writing the task report, stop. Do not begin the next task automatically.
