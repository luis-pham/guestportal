# Phase 01 Baseline and Transition Contract

Phase 01 has already been implemented. It is not to be rewritten as part of Phase 02.

## Required preflight before Task 02.1

The agent must inspect and record the actual repository state for:

- authentication provider and session model;
- organization and property tables;
- membership, role and property assignment tables;
- tenant context propagation in API and UI;
- authorization middleware/policies;
- PostgreSQL RLS status and migrations;
- audit-log foundation;
- Admin and Staff login routes;
- organization/property switcher behavior;
- existing tests for tenant isolation and IDOR.

## Required output

Create `evidence/phase-02/PHASE_01_BASELINE_REPORT.md` containing:

- discovered paths and symbols;
- migrations already applied;
- public contracts Phase 02 must preserve;
- known gaps or failing tests;
- explicit statement that Phase 01 was not reimplemented;
- baseline commit SHA when Git is available.

## Compatibility rules

Phase 02 may consume Phase 01 APIs and components. It may make narrowly scoped compatibility fixes only when necessary to integrate the app shell. Any such fix must:

1. be documented in the current task report;
2. preserve tenant isolation;
3. include regression tests;
4. not change role semantics without an ADR;
5. not introduce mock authentication into production paths.

## Stop conditions

Mark the current task `BLOCKED` when:

- tenant context cannot be reliably determined;
- existing authentication contracts are ambiguous;
- Phase 01 tests expose cross-tenant leakage;
- migrations and application models materially disagree;
- the agent would need to redesign authentication or tenancy to proceed.
