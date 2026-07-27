# Task 03.5 — Preview modes and navigation editing

## Result

**PASS**

## Dependency

Task 03.4 `PASS`

## Implemented

| Area | Output |
|---|---|
| `packages/contracts` | Preview query/response + navigation update schemas |
| `apps/api` | `GET .../portal/preview`, `GET .../locations`, `PUT .../portal/navigation`; location isolation |
| `apps/admin-web` | Navigation editor + preview panel (locale/device/location) |

## Acceptance criteria

| Criterion | Status |
|---|---|
| Preview uses draft without publishing (`source: draft`) | PASS |
| Navigation respects schema | PASS |
| Location context cannot cross property | PASS (403 on foreign locationId) |

## Tests

- API integration: 13 passed (includes preview + location isolation)
- Admin e2e: 24 passed
- Screenshots: `evidence/phase-03/03.5/screenshots/portal-preview-{390,430,1280,1440}.png`

## Classification

**PASS**
