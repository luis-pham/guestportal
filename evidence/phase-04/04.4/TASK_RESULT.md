# Task 04.4 — Explore, guide and mobile navigation

## Result

**PASS**

## Dependency

Task 04.3 `PASS`

## Delivered

- Guest routes: `/g/:qrToken/explore`, `/guide`, `/chat` with QR token preserved
- `GuestMobileNav` (≤5 items from published `primaryNavigation`, location-safe hrefs)
- Explore/Guide views from portal config only (no hardcoded catalog) + empty states
- VI/EN locale toggle via session recreate
- Default portal config includes explore + guide sections

## Tests / evidence

- unit: `locationSafeHref` + locale pick — guest-web vitest
- e2e navigation + locale — `e2e-output.txt`, `screenshots/explore-390.png`, `guide-390.png`

## Acceptance

- [x] no hardcoded catalog content
- [x] links are location-safe
- [x] VI/EN complete

## Classification

**PASS**
