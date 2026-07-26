# Phase 08 — Request, Order and Staff Workspace

## Scope

- Request lifecycle.
- Order lifecycle.
- Catalog/cart.
- Staff inbox.
- Claim/assign.
- Chat.
- Status update.
- Completion.
- Realtime.
- Notifications.
- Mobile PWA.

## Acceptance criteria

- Guest tạo request/order.
- Staff nhận realtime.
- Hai staff claim conflict xử lý đúng.
- State transition đúng.
- Guest thấy status.
- Chat xuyên ngôn ngữ.
- PWA mobile usable.
- Audit history.
- Price/item snapshot.

## Test bắt buộc

- State machine unit.
- Transaction/concurrency integration.
- WebSocket reconnect.
- E2E guest → staff → guest.
- Duplicate event.
- Offline/reload.
- Mobile screenshots.
- Accessibility.
- Push notification nếu nằm trong scope và môi trường hỗ trợ.

## Gate

Không PASS nếu request/order chỉ lưu DB nhưng UI staff chưa hoàn chỉnh.
