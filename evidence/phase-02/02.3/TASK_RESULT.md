# Task 02.3 — Admin application shell

## Result

**PASS**

## Commits

- Start / baseline HEAD: Task 02.2 PASS baseline (working tree continued)
- End: uncommitted Task 02.3 working tree (no commit created; not requested)
- Dependency: Task 02.2 `PASS` (`evidence/phase-02/02.2/TASK_RESULT.md`)

## Documents read

1. Repository `README.md`
2. `guest-portal-production-docs/README.md`
3. `execution/00_EXECUTION_README.md`
4. `reserved/00_RESERVED_ARCHITECTURE.md`
5. `reserved/04_AGENT_CHECKLIST.md`
6. `execution/01_PHASE_01_BASELINE_AND_TRANSITION.md`
7. `execution/02_REPOSITORY_MAP_AND_FILE_OWNERSHIP.md`
8. `execution/03_IMPLEMENTATION_ORDER_AND_DEPENDENCIES.md`
9. `execution/tasks/02.3_admin_application_shell.md`
10. `phases/PHASE_02_DESIGN_SYSTEM_APP_SHELL.md`
11. `04_UI_UX_ARCHITECTURE.md`
12. `13_ROUTE_AND_NAVIGATION_MAP.md`
13. `14_SCREEN_SPECIFICATIONS.md`
14. `17_PERMISSION_MATRIX.md`
15. `21_UI_VISUAL_ACCEPTANCE_STANDARD.md`

## Files changed

Allowed paths: `apps/admin-web/**`, `packages/ui/**` (+ evidence under `evidence/phase-02/02.3/`)

- Shared `AdminShell` (`packages/ui/src/AdminShell.tsx`) with primary/secondary nav labeled as `navigation` landmarks, header, breadcrumbs, collapse control
- Admin locale shell routes with permission-aware primary/secondary nav
- Organization/property switchers via Phase 01 `/v1/me`, `/v1/organizations`, `/v1/properties`
- Route-level `loading.tsx` / `error.tsx`
- Long VI/EN shell labels in messages
- E2E: `apps/admin-web/e2e/admin-shell.spec.ts` (+ auth shell coverage)
- Runner: `scripts/run-admin-e2e.mjs`

Scope note (build artifact only, no Phase 01 redesign): rebuilt `@guestportal/auth` dist so `can()` matches already-fixed source (stale dist denied assigned-role property list reads).

## Migrations created

None.

## Tests executed

```bash
pnpm --filter @guestportal/auth build
pnpm --filter @guestportal/api build
pnpm --filter @guestportal/admin-web build
node scripts/run-admin-e2e.mjs
```

Logs / reports:

- `evidence/phase-02/02.3/e2e.log` — 9 passed
- `evidence/phase-02/02.3/validation.log`
- `evidence/phase-02/02.3/screenshots/admin-shell-{1024,1280,1440}.png`

## Required viewports

1024, 1280, 1440 — captured.

## Acceptance checklist

- [x] responsive Admin shell at required widths
- [x] permission-aware navigation (viewer does not see Settings)
- [x] organization/property switcher using Phase 01 contracts
- [x] route-level loading/error boundaries
- [x] E2E navigation and role visibility
- [x] keyboard navigation covered in shell e2e
- [x] long VI/EN label coverage
- [x] no unauthorized navigation exposure
- [x] no placeholder-only navigation presented as complete modules

## Reserved architecture check

PASS. Shell and honest module workspace frames only. No Platform Admin, billing, pricing, subscriptions, plans, payment providers, invoices, marketplace, or CRM.

## Known limitations

- Module workspaces remain shell frames until later phases implement domain features.
- Auth package source was not redesigned; only dist rebuild from locked Phase 01 source.

## Result classification

**PASS**
