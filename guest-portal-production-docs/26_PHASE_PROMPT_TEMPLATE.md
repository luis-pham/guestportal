# Phase Prompt Template for AI Coding Agent

Use one phase per execution window.

```text
You are implementing Phase <XX> of the QR Guest Portal.

Canonical documents:
- README.md
- <list exact relevant specs>
- phases/PHASE_<XX>_....md

Rules:
1. Inspect the existing repository before making changes.
2. Do not modify architecture or scope silently.
3. Implement real production code, not placeholders.
4. Use the shared design system and i18n.
5. Enforce tenant scope in every data path.
6. Run every mandatory test for this phase.
7. Generate evidence using the repository scripts.
8. Do not state PASS yourself. Run `pnpm phase:verify <XX>`.
9. If a required external credential is missing, mark the exact integration BLOCKED.
10. Stop after this phase. Do not begin the next phase.

Before coding:
- Output the files/modules you expect to modify.
- Output acceptance criteria mapped to tests.
- Identify risks.

After coding:
- Run lint, typecheck, tests, build and phase-specific checks.
- Inspect UI screenshots.
- Create UI_REVIEW.md.
- Fix defects.
- Run verification again.
- Report only generated status and exact remaining issues.
```
