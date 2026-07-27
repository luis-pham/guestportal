# Execution Layer — How the Coding Agent Must Work

This directory is the mandatory execution layer above the canonical product and architecture documents.

## Fixed roadmap

The project remains **11 phases: Phase 00 through Phase 10**. Do not renumber, split, merge, or replace phases. Smaller units are tasks inside their existing phase.

## Current baseline

- Phase 00: previously implemented or verified by the project owner.
- Phase 01: implementation already exists and must be treated as an inherited baseline.
- Next implementation target: Phase 02, beginning with Task 02.1.

## Mandatory reading order for every task

1. `execution/00_EXECUTION_README.md`
2. `reserved/00_RESERVED_ARCHITECTURE.md`
3. `reserved/04_AGENT_CHECKLIST.md`
4. `execution/01_PHASE_01_BASELINE_AND_TRANSITION.md`
5. `execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md`
6. `execution/03_IMPLEMENTATION_ORDER_AND_DEPENDENCIES.md`
7. Current phase document under `phases/`
8. Current task manifest under `execution/tasks/`
9. Only the canonical documents listed in the task manifest
10. Existing source code and tests in the allowed paths

Do not load unrelated specifications merely because they exist.

## One-task rule

The agent must execute exactly one task manifest at a time. It must stop after producing the task result and evidence. It must not silently continue to another task.

## Source of truth precedence

1. Security, tenant isolation and honesty gates
2. Canonical numbered documents
3. Phase document
4. Task manifest
5. Existing code behavior
6. Agent assumptions

If sources conflict, stop implementation, write the conflict into the task report and mark the task `BLOCKED` unless the conflict can be resolved without changing product behavior.

## Completion states

- `PASS`: all required checks ran and evidence exists.
- `FAIL`: implementation or required checks failed.
- `BLOCKED`: external dependency, missing credential, unresolved conflict or unavailable environment prevents honest verification.

The agent may never write PASS based only on code inspection or confidence.


## Reserved architecture rule

The documents under `reserved/` protect intentionally deferred Platform Admin, plan, subscription and billing decisions. They do not create a new phase or task. Do not implement or scaffold those modules unless a future approved specification activates them.
