# Task 02.1 — Design tokens and theme foundation

## Result

**PASS**

## Commits

- Start / baseline HEAD: `ea38da7d3537cdad48762c399f7eadda396167a3`
- End: uncommitted Task 02.1 working tree (no commit created; not requested)

## Documents read

1. Repository `README.md`
2. `guest-portal-production-docs/README.md`
3. `execution/00_EXECUTION_README.md`
4. `reserved/00_RESERVED_ARCHITECTURE.md`
5. `reserved/04_AGENT_CHECKLIST.md`
6. `execution/01_PHASE_01_BASELINE_AND_TRANSITION.md`
7. `execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md`
8. `execution/03_IMPLEMENTATION_ORDER_AND_DEPENDENCIES.md`
9. `execution/04_TASK_EXECUTION_PROTOCOL.md`
10. `execution/PHASE_02_EXECUTION_PLAN.md`
11. `execution/tasks/02.1_design_tokens_and_theme_foundation.md`
12. `phases/PHASE_02_DESIGN_SYSTEM_APP_SHELL.md`
13. `05_DESIGN_SYSTEM.md`
14. `21_UI_VISUAL_ACCEPTANCE_STANDARD.md` (partial; tokens/layout/typography relevance)

## Preflight

- Created `evidence/phase-02/PHASE_01_BASELINE_REPORT.md`
- Phase 01 treated as locked baseline (auth/tenancy/RLS not modified)
- Reverted unrelated prior working-tree change to `apps/admin-web/src/lib/api.ts` (outside allowed paths)

## Files changed

Allowed paths only:

- `packages/ui/package.json`
- `packages/ui/src/tokens.ts`
- `packages/ui/src/tokens.css`
- `packages/ui/src/tokens.test.ts`
- `packages/ui/src/tailwind-theme.ts` (new)
- `packages/ui/src/theme/THEME.md` (new)
- `packages/ui/src/index.ts`
- `apps/admin-web/src/styles/theme.css` (new; actual path for logical `apps/admin/**`)
- `apps/staff-web/src/styles/theme.css` (new; actual path for logical `apps/staff/**`)

Evidence:

- `evidence/phase-02/PHASE_01_BASELINE_REPORT.md`
- `evidence/phase-02/02.1/**`

## Migrations created

None.

## Tests executed

Exact commands (from repo root):

```bash
pnpm --filter @guestportal/ui test
pnpm --filter @guestportal/ui lint
pnpm --filter @guestportal/ui typecheck
pnpm --filter @guestportal/ui build
```

Logs:

- `evidence/phase-02/02.1/unit-test.log` — 8 passed, exit 0
- `evidence/phase-02/02.1/lint.log` — exit 0
- `evidence/phase-02/02.1/typecheck.log` — exit 0
- `evidence/phase-02/02.1/build.log` — exit 0
- `evidence/phase-02/02.1/storybook-smoke.log` — Storybook not present; smoke skipped per manifest (“if already present”)

## Required viewports

None (per task manifest). No screenshots required for 02.1.

## Acceptance checklist

- [x] semantic color, spacing, typography, radius, shadow and motion tokens
- [x] CSS variables (`packages/ui/src/tokens.css`)
- [x] Tailwind/theme integration (`guestPortalTailwindTheme` / `guestPortalTailwindPreset`)
- [x] light theme baseline + documented extension points (`THEME.md`, `data-theme`, guest brand seam)
- [x] unit tests for token exports
- [x] build, typecheck, lint
- [x] no hardcoded feature colors in new theme code
- [x] Vietnamese typography stack / sample covered in tests
- [x] tokens use semantic names, not page-specific names

## Scope exceptions

None. Path deviation documented only: manifest lists `apps/admin/**/styles/**` and `apps/staff/**/styles/**`; repository uses `apps/admin-web` and `apps/staff-web` (see baseline report mapping).

## Known limitations

- App layouts are not yet switched to import `src/styles/theme.css` (reserved for shell tasks 02.3/02.4; outside this task’s need to avoid touching non-`styles` app files).
- Tailwind is not installed as a runtime dependency; the preset is ready for consumers when Tailwind is adopted.
- Component primitives, shells, Storybook, and i18n are intentionally deferred to Tasks 02.2–02.5.

## Reserved Architecture Check

Reserved Architecture Check: **PASS**
Deferred decisions touched: **none**
Speculative commercial logic introduced: **no**

## Stop condition

Task 02.1 complete. **Stopping here.** Do not begin Task 02.2.
