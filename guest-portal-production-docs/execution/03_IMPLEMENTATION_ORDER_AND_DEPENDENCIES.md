# Implementation Order and Dependency Graph

## Fixed order

Phase 01 baseline verification must complete before Task 02.1.

Within each phase, tasks execute in numeric order unless a manifest explicitly declares safe parallelism. A task is eligible only when every listed dependency is `PASS`.

## Phase chain

`00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10`

No phase may be skipped. Phase 07 may be `BLOCKED` for unavailable Gemini credentials, but downstream planning must not misrepresent voice as verified.

## Task chains

- Phase 02: `02.1 → 02.2 → 02.3 → 02.4 → 02.5 → 02.6 → 02.GATE`
- Phase 03: `03.1 → 03.2 → 03.3 → 03.4 → 03.5 → 03.6 → 03.7 → 03.GATE`
- Phase 04: `04.1 → 04.2 → 04.3 → 04.4 → 04.5 → 04.6 → 04.GATE`
- Phase 05: `05.1 → 05.2 → 05.3 → 05.4 → 05.5 → 05.6 → 05.GATE`
- Phase 06: `06.1 → 06.2 → 06.3 → 06.4 → 06.5 → 06.GATE`
- Phase 07: `07.1 → 07.2 → 07.3 → 07.4 → 07.5 → 07.GATE`
- Phase 08: `08.1 → 08.2 → 08.3 → 08.4 → 08.5 → 08.6 → 08.GATE`
- Phase 09: `09.1 → 09.2 → 09.3 → 09.4 → 09.5 → 09.GATE`
- Phase 10: `10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6 → 10.GATE`

## Gate rule

A phase gate is not an implementation task. It aggregates machine evidence from all tasks, reruns required regression suites and writes the phase result using `22_AUTOMATED_PHASE_GATE.md`.
