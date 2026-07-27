# Phase Gate Checklist

The phase gate runs only after all task manifests for that phase have a result.

- [ ] Every required task is PASS, or an explicitly permitted external integration is BLOCKED.
- [ ] No task result is missing.
- [ ] Full phase unit, integration and E2E suites executed.
- [ ] Tenant-isolation regression suite executed.
- [ ] Build, typecheck and lint executed.
- [ ] Required UI screenshots exist and were manually reviewed.
- [ ] Accessibility results meet the phase standard.
- [ ] Migrations apply cleanly from a fresh database.
- [ ] Migration upgrade path from previous phase verified.
- [ ] OpenAPI/contracts regenerated and diff reviewed where applicable.
- [ ] No production mock, hardcoded secret or fake PASS marker found.
- [ ] Phase result generated according to `22_AUTOMATED_PHASE_GATE.md`.
