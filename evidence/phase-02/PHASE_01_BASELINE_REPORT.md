# Phase 01 Baseline Report

Generated before Task 02.1. Phase 01 is an inherited baseline and was **not** reimplemented.

## Baseline commit

- SHA: `ea38da7d3537cdad48762c399f7eadda396167a3`
- Tip subject: `fix: reliably stop phase 01 e2e child process groups`

## Path mapping (logical → actual)

| Logical area | Actual path |
|---|---|
| Shared UI | `packages/ui/**` |
| Admin application | `apps/admin-web/**` |
| Staff application | `apps/staff-web/**` |
| Guest application | `apps/guest-web/**` |
| API | `apps/api/**` |
| Database | `packages/db/**` |
| Auth | `packages/auth/**` |
| Tenancy | `packages/tenancy/**` |

## Authentication and session

- Provider: custom cookie session (`gp_session`), not a third-party IdP.
- Symbols: `SESSION_COOKIE`, `createSession`, `resolveSession`, `revokeSession` in `packages/auth/src/session.ts`.
- Password hashing: `hashPassword` / `verifyPassword` (bcrypt) in `packages/auth/src/password.ts`.
- API routes: `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/me`, `GET /v1/me/memberships` in `apps/api/src/routes/auth.ts`.
- Request auth plugin: `apps/api/src/plugins/auth.ts` resolves session cookie into `request.auth`.

## Organization / property / membership

- Tables (Drizzle): `organizations`, `properties`, `users`, `organizationMemberships`, `propertyAssignments`, `sessions`, `auditLogs` in `packages/db/src/schema.ts`.
- Roles / permissions: `ROLES`, `PERMISSIONS`, `roleHasPermission`, `can`, `assertCan`, `visiblePropertyIds` in `packages/auth`.
- Tenant helpers: `withTenantTransaction` sets `app.organization_id` / `app.user_id` in `packages/db/src/client.ts`.
- API: `/v1/organizations`, `/v1/properties` with RBAC via `apps/api/src/auth-context.ts`.

## RLS and migrations

Applied SQL under `packages/db/drizzle/`:

- `0000_phase01_auth_tenancy.sql` — schema + FORCE RLS policies
- `0001_app_role_no_bypass_rls.sql` — `guestportal_app` NOSUPERUSER NOBYPASSRLS
- `0002_rls_default_org_setting.sql` — role defaults + coalesce NULL GUC handling

Runtime `DATABASE_URL` should use `guestportal_app`; migrate/seed use `DATABASE_OWNER_URL`.

## Admin / Staff login UI

- Admin login: `apps/admin-web/src/app/[locale]/login/page.tsx` (VI/EN via next-intl).
- Admin dashboard org switcher: `apps/admin-web/src/app/[locale]/page.tsx` (`data-testid="org-switcher"`).
- Staff: still Phase 00 placeholder shell at `apps/staff-web/src/app/page.tsx` (no login UI yet).

## Tests covering tenant isolation / IDOR

- Unit: `packages/auth/src/roles.test.ts`
- Integration: `apps/api/src/tenant.integration.test.ts` (cross-tenant list deny, property-manager scope, logout revocation, RLS org filter, IDOR property fetch)
- E2E: `apps/admin-web/e2e/auth.spec.ts`
- VPS gate: `pnpm phase:verify 01` reported **PASS** at baseline commit.

## Public contracts Phase 02 must preserve

- Cookie name `gp_session` and session resolve/revoke semantics.
- Membership + assigned `propertyIds` shape returned by `/v1/auth/login` and `/v1/me`.
- Organization/property RBAC and RLS GUC model.
- Seed fixtures (`*.aurora.test`, `*.nomad.test`, password `Password123!`).
- Error envelope codes used by Admin UI (`FORBIDDEN`, `UNAUTHORIZED`, etc.).

## Known gaps (not redesigned here)

- Staff login/session UI not built (Phase 02.4/02.5 territory).
- Admin still uses `AppShellPlaceholder` (Phase 02.3).
- Logout with empty JSON `Content-Type` can 500 in browser; outside Task 02.1 allowed paths — deferred.
- Design tokens exist but lack shadow/motion/typography scale completeness and app `styles/` theme entrypoints (Task 02.1 scope).

## Explicit statement

Phase 01 authentication, tenancy, RLS, audit log foundation, and related tests were inspected only. No Phase 01 redesign or reimplementation was performed for this report.
