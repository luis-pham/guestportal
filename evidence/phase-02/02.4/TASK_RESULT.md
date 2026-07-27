# Task 02.4 — Staff application shell

## Result

**PASS**

## Commits

- Start: Task 02.3 PASS working tree
- End: uncommitted Task 02.4 working tree (no commit created; not requested)
- Dependency: Task 02.3 `PASS`

## Documents read

1. Repository / execution / reserved architecture docs (per protocol)
2. `execution/tasks/02.4_staff_application_shell.md`
3. `phases/PHASE_02_DESIGN_SYSTEM_APP_SHELL.md`
4. `04_UI_UX_ARCHITECTURE.md`, `13_ROUTE_AND_NAVIGATION_MAP.md`, `14_SCREEN_SPECIFICATIONS.md`, `17_PERMISSION_MATRIX.md`, `21_UI_VISUAL_ACCEPTANCE_STANDARD.md`

## Files changed

Allowed paths: `apps/staff-web/**`, `packages/ui/**` (+ evidence, + `scripts/run-staff-e2e.mjs`, lockfile)

- `StaffShell` + CSS (desktop sidebar, mobile bottom nav, offline banner, skip link)
- Staff locale app: login, inbox/my-work/messages/history/settings/more, request/order detail shells
- Auth-gated workspace (`request.read`), org/property switchers, loading/error/offline states
- E2E + axe + responsive screenshots 360/390/768/1280

## Migrations created

None.

## Tests executed

```bash
pnpm --filter @guestportal/staff-web lint
pnpm --filter @guestportal/staff-web typecheck
pnpm --filter @guestportal/staff-web test
pnpm --filter @guestportal/staff-web build
node scripts/run-staff-e2e.mjs
```

Logs: `lint.log`, `typecheck.log`, `unit-test.log`, `build.log`, `e2e.log` (8 passed)
Screenshots: `screenshots/staff-shell-{360,390,768,1280}.png`

## Acceptance checklist

- [x] usable on 360 px
- [x] Staff cannot enter Admin-only routes (no Portal/Analytics links)
- [x] no Phase 08 workflow implemented
- [x] E2E role access (staff vs content manager)
- [x] keyboard and touch-target checks
- [x] axe (no critical/serious)

## Reserved architecture check

PASS. No billing, plans, Platform Admin, marketplace, or CRM.

## Result classification

**PASS**
