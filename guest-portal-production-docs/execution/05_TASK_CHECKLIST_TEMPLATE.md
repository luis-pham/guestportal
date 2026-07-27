# Task Checklist Template

## Identity

- [ ] Current task ID matches the requested task.
- [ ] Required dependency tasks are PASS.
- [ ] Current Git state recorded.

## Context

- [ ] Mandatory execution documents read.
- [ ] Only task-listed canonical documents read.
- [ ] Existing code inspected before design changes.
- [ ] Phase 01 contracts preserved.

## Scope

- [ ] Changes remain in allowed paths.
- [ ] No future-phase feature implemented.
- [ ] Scope exceptions documented before editing.

## Implementation

- [ ] Contracts/schema updated first where applicable.
- [ ] Tenant filtering enforced.
- [ ] Errors, loading and empty states implemented.
- [ ] i18n strings are externalized.
- [ ] No production mocks or hardcoded secrets.

## Verification

- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] E2E tests pass where required.
- [ ] Build/typecheck/lint pass.
- [ ] Security and tenant tests pass.
- [ ] UI screenshots and accessibility evidence exist where required.

## Reporting

- [ ] `TASK_RESULT.md` completed.
- [ ] Evidence paths are valid.
- [ ] Result is honest: PASS, FAIL or BLOCKED.
- [ ] Agent stopped after this task.
