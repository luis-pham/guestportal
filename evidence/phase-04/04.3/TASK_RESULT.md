# Task 04.3 — Guest homepage and brand renderer

## Result

**PASS**

## Dependency

Task 04.2 `PASS`

## Scope note

Manifest allowed `apps/guest/**` + `packages/ui/**` only. Added `GET /v1/guest/portal` (+ contracts) as a required exception so the homepage can render **published** branding/config (acceptance: published version only).

## Delivered

- `packages/ui` `GuestHomepage` brand renderer (cover/logo fallbacks, location, quick actions, assistant entry)
- Guest web `/g/[qrToken]` loads session then published portal
- `GET /v1/guest/portal` — published portal + branding public URLs + missing asset flags

## Tests / evidence

- UI unit + axe: `pnpm --filter @guestportal/ui test`
- API integration: guest portal published + fallbacks
- Responsive E2E 320/390/430 + axe critical=0 — `e2e-output.txt`, `screenshots/homepage-*.png`

## Acceptance

- [x] published version only
- [x] 320–430 px usable
- [x] brand and location correct
- [x] missing asset fallback

## Classification

**PASS**
