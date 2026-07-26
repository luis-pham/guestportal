# Phase 04 — QR Resolution and Guest Portal

## Scope

- QR create/disable/download.
- Opaque token resolution.
- Guest session.
- Property/location context.
- Guest homepage.
- Quick actions.
- Explore.
- Guide.
- Locale detection.
- Mobile navigation.
- Status center shell.

## Acceptance criteria

- QR không lộ ID.
- Disabled QR bị chặn.
- Guest portal đúng brand/location.
- 320–430 px usable.
- Loading/error/offline states.
- Language switching.
- Public asset qua R2/CDN.
- Lighthouse target hợp lý.

## Test bắt buộc

- Token guessing/rate limit.
- QR resolve integration.
- E2E scan/open.
- Multi-property isolation.
- Responsive screenshots.
- Lighthouse.
- axe.
- Slow network test.
- Missing cover/logo fallback.

## Gate

Guest Portal không được PASS nếu initial experience còn skeleton giả hoặc text hard-code.
