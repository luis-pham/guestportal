# Lotavi UI Visual Conformance Audit

Source references:
- `/Users/huypq/Documents/Admin Dashboard Visual Blueprint/Design-Blueprint.md`
- `/Users/huypq/Documents/Admin Dashboard Visual Blueprint/Aria Admin.dc.html`
- `/Users/huypq/.codex/attachments/99bfef95-d28f-49bb-8ec1-a20cda9c8d30/pasted-text.txt`

Previous changed commit: `ad8a154`

Actually changed in `ad8a154`:
- Shared primitives: `PageHeader`, `FilterBar`, `StatusBadge`
- Shared admin/staff shell tokens and branding
- Admin Orders and Admin Requests operations panel
- Staff Operations workspace

Not actually refactored in `ad8a154`:
- Admin dashboard/overview fallback
- Portal Builder surrounding admin composition
- Knowledge Base
- Services/Menu/Catalog placeholders
- Reviews placeholder
- Analytics panel
- Staff/Users/Roles/Team
- Property Settings
- Integrations placeholder
- Audit Logs panel
- Admin Messages placeholder
- Staff Dashboard, My Orders, My Requests, Messages, Profile, Shift state

## Blueprint Target Summary

The approved blueprint is a warm greige operational dashboard:
- Canvas `#F6F4F0`, surface `#FDFCFA`, sunken `#F1EEE9`
- Marine accent `#1F5F5B`, hover `#194F4B`, soft active `#EDF3F1`
- Ink `#26241F`, secondary `#6B655C`, muted `#9A938A`, faint label `#B4ADA2`
- Borders `#E9E4DC` and `#ECE8E1`
- Hanken Grotesk UI, Newsreader display, Spline Sans Mono identifiers
- Fixed 56px topbar, 256px sidebar, 1320px max workspace, 28px/40px workspace padding
- Flat 14px panels, 9px controls, 56px rows, overline table headers
- Hub/list/detail model with right drawers/panels, not full-page modal churn

## Screen Audit

| Screen | Current route | Current component | Target reference | Status | Similarity |
|---|---|---|---|---|---|
| Admin Dashboard | `/admin/{locale}/properties` | fallback `module-workspace` in `apps/admin-web/src/app/[locale]/page.tsx` | Blueprint 5.1 Dashboard | MAJOR MISMATCH | 15% |
| Admin Orders | `/admin/{locale}/properties/{id}/operations/orders` | `AdminOperationsPanel` | Blueprint 5.8 Orders | PARTIAL MATCH | 45% |
| Admin Requests | `/admin/{locale}/properties/{id}/operations/requests` | `AdminOperationsPanel` | Blueprint 5.9 Service Requests | PARTIAL MATCH | 45% |
| Admin Messages | `/admin/{locale}/properties/{id}/operations/conversations` | fallback `module-workspace` | Blueprint 5.11 Messages | NOT IMPLEMENTED | 5% |
| Portal Builder | `/admin/{locale}/properties/{id}/portal/homepage` | `PortalBuilderWorkspace` + portal-builder CSS | Blueprint 5.2 Guest Portal Builder | PARTIAL MATCH | 35% |
| Knowledge Base | `/admin/{locale}/properties/{id}/knowledge` | `KnowledgeSourcesPanel` | Blueprint 5.3 Knowledge Base | MAJOR MISMATCH | 25% |
| Services/Catalog | `/admin/{locale}/properties/{id}/catalog` | fallback `module-workspace` | Blueprint 5.6 Service Catalog | NOT IMPLEMENTED | 5% |
| Menu | `/admin/{locale}/properties/{id}/catalog/products` | fallback `module-workspace` | Blueprint 5.7 Menu Management | NOT IMPLEMENTED | 5% |
| Reviews | `/admin/{locale}/properties/{id}/reviews` equivalent unavailable | fallback/not routed | Blueprint 5.13 Reviews | NOT IMPLEMENTED | 0% |
| Analytics | `/admin/{locale}/properties/{id}/analytics` | `AdminAnalyticsDashboard` | Blueprint 5.12 Analytics | PARTIAL MATCH | 30% |
| Staff/Admin Team | `/admin/{locale}/team` | `AdminTeamPanel` | Blueprint 5.14/5.15 | MAJOR MISMATCH | 25% |
| Roles | `/admin/{locale}/team` role data in team panel | no dedicated matrix | Blueprint 5.16 Roles | NOT IMPLEMENTED | 5% |
| Property Settings | `/admin/{locale}/properties/{id}/settings` | `PropertySettingsForm` | Blueprint 5.19 Property Settings | MAJOR MISMATCH | 25% |
| Integrations | `/admin/{locale}/settings/security` partial | no integration cards | Blueprint 5.21 Integrations | NOT IMPLEMENTED | 0% |
| Audit Logs | `/admin/{locale}/settings/audit-log` | `AdminAuditLogPanel` | Blueprint 5.18 Audit Logs | PARTIAL MATCH | 30% |
| Staff Dashboard | `/staff/{locale}/inbox` currently doubles as dashboard | `StaffWorkspace` + `StaffOperationsWorkspace` | Staff P0 shift dashboard | MAJOR MISMATCH | 30% |
| Staff My Work | `/staff/{locale}/my-work` | same workspace queue | Staff task list | PARTIAL MATCH | 40% |
| Staff Requests/Orders detail | `/staff/{locale}/requests/{id}`, `/orders/{id}` | `StaffDetailPanel` | Mobile/detail sheet pattern | PARTIAL MATCH | 40% |
| Staff Messages | `/staff/{locale}/messages` | same operations workspace, route key messages | Staff message inbox | NOT IMPLEMENTED | 10% |
| Staff Profile/Settings | `/staff/{locale}/settings` | same operations wrapper plus fixtures | Profile/shift state | MAJOR MISMATCH | 15% |

## Main Conformance Gaps

- Shell: current admin uses a separate secondary sidebar for selectors. Blueprint uses one grouped sidebar plus a 56px topbar with property switcher, global search, create, notification/help/avatar.
- Typography: current tokens use Source Sans/Source Serif/IBM Plex Mono. Blueprint requires Hanken Grotesk, Newsreader, Spline Sans Mono.
- Palette: current neutral base is cool grey. Blueprint is warm greige.
- Workspace: current admin stretches composition and relies on `gp-state` cards. Blueprint uses 1320px max width, 28px/40px padding, flat surfaces.
- Tables: operations table is native table but not exact blueprint row/header density and lacks tabs/chips/saved-view/search visual language.
- Drawers: operations currently use an always-visible side panel. Blueprint wants right drawer/detail panel that preserves list context; current panel can be evolved as fixed-width contextual panel for now.
- Placeholders: many admin modules render the old generic workspace instead of a blueprint-inspired screen.
- Staff: current staff screen is wrapped in a generic state card and still exposes regression fixtures visually. Blueprint expects shift-focused, touch-optimized operations surfaces.

## Migration Map

Shared:
- `packages/ui/src/tokens.css` current cool tokens -> blueprint warm greige tokens.
- `packages/ui/src/primitives.css` current generic components -> Aria/Lotavi surfaces, table, toolbar, status, shell.
- `packages/ui/src/AdminShell.tsx` two-sidebar shell -> grouped sidebar + topbar search/create/actions.
- `packages/ui/src/StaffShell.tsx` staff shell -> same visual family, mobile bottom nav preserved.

Admin:
- `apps/admin-web/src/app/[locale]/page.tsx` fallback workspace -> blueprint dashboard/table/form placeholder surfaces by active module.
- `apps/admin-web/src/components/AdminOperationsPanel.tsx` current page header/filter/table/detail -> lifecycle chips, warmer table, right contextual panel.
- `apps/admin-web/src/styles/theme.css` per-feature overrides -> blueprint admin cards/tables/forms/layout.
- Existing panels (`KnowledgeSourcesPanel`, `AdminAnalyticsDashboard`, `AdminTeamPanel`, `PropertySettingsForm`, `AdminAuditLogPanel`, `QrCodesPanel`) -> global CSS conformance layer for surfaces and tables without changing API logic.

Staff:
- `apps/staff-web/src/components/StaffWorkspace.tsx` remove visible regression fixtures from primary view, add shift pulse and property context.
- `apps/staff-web/src/components/StaffOperationsWorkspace.tsx` toolbar/list/detail -> blueprint card/list/detail density with semantic status.
- `apps/staff-web/src/components/staff-ops.css` -> warm greige surfaces, 56px header offset, mobile card triage.

## Accepted Deviations For This Pass

- No new icon dependency is introduced; existing text marks remain until a dedicated icon package is approved.
- Admin Messages, Integrations, Roles, Services/Menu are reimplemented as blueprint-inspired placeholder surfaces when no real feature component exists yet.
- Staff Messages/Profile/Shift state remain route-compatible but receive visual shell/workspace treatment first.
- Business logic, API calls, routes, permissions, data models and existing test IDs are preserved.

## Implementation Evidence

- Deployed commit: `a28b6ae`.
- VPS build: admin, staff, and guest frontends rebuilt with production base paths `/admin`, `/staff`, and `/guest`.
- VPS services verified active: `guestportal-admin-web`, `guestportal-staff-web`, `guestportal-web`, `guestportal-api`.
- Live capture URLs:
  - `https://app.lotavi.com/admin/en`
  - `https://app.lotavi.com/staff/en/inbox`
- Captured files:
  - `evidence/ui-conformance/admin/actual-desktop.png`
  - `evidence/ui-conformance/admin/actual-mobile.png`
  - `evidence/ui-conformance/staff/actual-desktop.png`
  - `evidence/ui-conformance/staff/actual-mobile.png`
  - `evidence/ui-conformance/capture-report.json`
- Live overflow assertions:
  - Admin desktop: pass.
  - Admin mobile 390px: pass.
  - Staff desktop: pass.
  - Staff mobile 390px: pass.
