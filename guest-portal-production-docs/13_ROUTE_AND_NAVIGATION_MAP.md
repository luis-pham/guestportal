# Route and Navigation Map

## 1. Mục tiêu

Tài liệu này khóa route, layout, navigation, quyền truy cập và trạng thái dữ liệu. AI không được tự tạo thêm route hoặc đổi cấu trúc navigation nếu chưa cập nhật tài liệu này.

## 2. Quy ước URL

- Admin: `/admin/*`
- Staff: `/staff/*`
- Guest: `/g/:qrToken/*`
- Public API: `/v1/*`
- Internal API: `/internal/*`
- WebSocket: `/realtime`
- Assets public: `https://assets.<domain>/*`

## 3. Admin route map

### App shell

Primary navigation:

1. Overview
2. Portal
3. Knowledge
4. Catalog
5. Operations
6. Analytics
7. Team
8. Settings

Global controls:

- Organization switcher
- Property switcher
- Command search
- Locale switcher
- Help
- User profile

### Routes

| Route | Primary nav | Secondary nav | Permission |
|---|---|---|---|
| `/admin` | Overview | None | dashboard.read |
| `/admin/properties` | Overview | Properties | property.read |
| `/admin/properties/new` | Overview | Properties | property.create |
| `/admin/properties/:propertyId` | Overview | Property overview | property.read |
| `/admin/properties/:propertyId/portal` | Portal | Overview | portal.read |
| `/admin/properties/:propertyId/portal/branding` | Portal | Branding | portal.update |
| `/admin/properties/:propertyId/portal/navigation` | Portal | Navigation | portal.update |
| `/admin/properties/:propertyId/portal/homepage` | Portal | Homepage | portal.update |
| `/admin/properties/:propertyId/portal/pages` | Portal | Pages | portal.update |
| `/admin/properties/:propertyId/portal/quick-actions` | Portal | Quick actions | portal.update |
| `/admin/properties/:propertyId/portal/preview` | Portal | Preview | portal.read |
| `/admin/properties/:propertyId/portal/publish-history` | Portal | Publish history | portal.publish |
| `/admin/properties/:propertyId/knowledge` | Knowledge | Sources | knowledge.read |
| `/admin/properties/:propertyId/knowledge/new` | Knowledge | Sources | knowledge.create |
| `/admin/properties/:propertyId/knowledge/:sourceId` | Knowledge | Sources | knowledge.read |
| `/admin/properties/:propertyId/knowledge/search-test` | Knowledge | Search test | knowledge.test |
| `/admin/properties/:propertyId/knowledge/missing-answers` | Knowledge | Missing answers | knowledge.read |
| `/admin/properties/:propertyId/catalog` | Catalog | Overview | catalog.read |
| `/admin/properties/:propertyId/catalog/categories` | Catalog | Categories | catalog.manage |
| `/admin/properties/:propertyId/catalog/products` | Catalog | Products | catalog.manage |
| `/admin/properties/:propertyId/catalog/services` | Catalog | Services | catalog.manage |
| `/admin/properties/:propertyId/catalog/availability` | Catalog | Availability | catalog.manage |
| `/admin/properties/:propertyId/operations/requests` | Operations | Requests | request.read |
| `/admin/properties/:propertyId/operations/orders` | Operations | Orders | order.read |
| `/admin/properties/:propertyId/operations/conversations` | Operations | Conversations | conversation.read |
| `/admin/properties/:propertyId/operations/qr` | Operations | QR codes | qr.manage |
| `/admin/properties/:propertyId/analytics` | Analytics | Overview | analytics.read |
| `/admin/properties/:propertyId/analytics/operations` | Analytics | Operations | analytics.read |
| `/admin/properties/:propertyId/analytics/ai` | Analytics | AI & RAG | analytics.read |
| `/admin/team` | Team | Members | team.read |
| `/admin/team/invitations` | Team | Invitations | team.manage |
| `/admin/settings/organization` | Settings | Organization | organization.update |
| `/admin/settings/security` | Settings | Security | security.manage |
| `/admin/settings/audit-log` | Settings | Audit log | audit.read |
| `/admin/settings/integrations` | Settings | Integrations | integration.manage |

## 4. Staff route map

Primary mobile navigation:

- Inbox
- My work
- Messages
- More

| Route | Purpose |
|---|---|
| `/staff` | Redirect to inbox |
| `/staff/inbox` | All unclaimed/new items |
| `/staff/my-work` | Claimed by current staff |
| `/staff/requests/:requestId` | Request detail |
| `/staff/orders/:orderId` | Order detail |
| `/staff/messages` | Conversations |
| `/staff/messages/:conversationId` | Conversation detail |
| `/staff/history` | Completed/rejected/cancelled |
| `/staff/settings` | Locale, notification, account |

## 5. Guest route map

| Route | Purpose |
|---|---|
| `/g/:qrToken` | Resolve QR and portal home |
| `/g/:qrToken/explore` | Explore collections |
| `/g/:qrToken/services` | Services/catalog |
| `/g/:qrToken/services/:itemId` | Product/service detail |
| `/g/:qrToken/cart` | Cart |
| `/g/:qrToken/guide` | Digital guide |
| `/g/:qrToken/guide/:articleId` | Article |
| `/g/:qrToken/chat` | Unified text/voice assistant |
| `/g/:qrToken/requests` | Guest request history |
| `/g/:qrToken/requests/:requestId` | Request status |
| `/g/:qrToken/orders` | Guest order history |
| `/g/:qrToken/orders/:orderId` | Order status |
| `/g/:qrToken/notifications` | In-portal notifications |

## 6. Layout rules

### Admin

- Route chuyển primary module: primary sidebar active.
- Route trong module: secondary sidebar active.
- Workspace giữ page header cố định theo layout.
- Deep route phải có breadcrumb.
- Builder route dùng full-bleed workspace và 3-panel layout.

### Staff

- Desktop/tablet: inbox list + detail split pane.
- Mobile: list và detail là hai route riêng.
- Back action phải giữ filter và scroll state.

### Guest

- QR token luôn được bảo toàn trong navigation.
- Không expose internal entity IDs nếu có thể dùng public token.
- Bottom navigation tối đa 5 mục.
- Assistant luôn truy cập được từ homepage và bottom navigation.
