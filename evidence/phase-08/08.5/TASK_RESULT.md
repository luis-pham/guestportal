# 08.5 Realtime Events, Reconnect, And Notifications

Result: PASS

Implemented reliable realtime delivery for request, order, and conversation activity using the existing Postgres outbox as the source of truth.

What changed:
- Added staff and guest realtime JSON replay endpoints plus SSE stream endpoints.
- Added tenant/property/session scoping for all realtime reads.
- Added cursor replay, duplicate-event dedupe, missing-cursor recovery, SSE retry hints, keepalive, and HTTP replay fallback.
- Added staff in-app live notifications for newly submitted/changed work.
- Added guest status live notifications and optimistic status convergence from status_changed event payloads.
- Added outbox events for conversation handoff/messages and included guestSessionId/conversationId in request/order status events.

Required coverage:
- Reconnect: PASS, cursor replay and SSE reconnect path covered by integration and browser reload tests.
- Duplicate event: PASS, repeated cursor replay is harmless and lastEventId replay excludes already seen events.
- Offline/reload: PASS, staff inbox and guest status converge after reload.
- Notification integration: PASS, in-app notifications are supported; Web Notification is used only when permission is already granted.

Evidence:
- `realtime-integration.txt`: API integration suite passed, 14 files / 51 tests.
- `staff-realtime-e2e.txt`: staff Playwright suite passed, 20 tests.
- `guest-realtime-e2e.txt`: guest Playwright suite passed, 8 tests.
- `axe-staff-realtime.json`: `violations: []`.
- `axe-guest-realtime.json`: `violations: []`.
- `screenshots/staff-realtime-inbox-390.png`.
- `screenshots/guest-status-realtime-390.png`.

Scope notes:
- `packages/realtime` does not exist in this repo; realtime delivery was implemented in `apps/api` and the staff/guest web clients.
- Task path `apps/staff/**` maps to this repo's `apps/staff-web/**`; `apps/guest/**` maps to `apps/guest-web/**`.
- No external realtime provider was introduced.

Reserved Architecture Check: PASS
Deferred decisions touched: none
Speculative commercial logic introduced: no
