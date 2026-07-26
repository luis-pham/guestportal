# Screen Specifications

## 1. Quy tắc

Mỗi màn hình phải được triển khai theo cấu trúc:

- Purpose
- User roles
- Entry points
- Data dependencies
- Layout
- Components
- Actions
- States
- Validation
- Responsive behavior
- Analytics events
- Acceptance tests

AI không được tự thay form dài thành modal hoặc tự gom màn hình nếu trái tài liệu.

---

# A. Admin Screens

## A1. Admin Dashboard

### Purpose

Cho người quản lý biết tình trạng vận hành và điểm cần xử lý.

### Layout

- Page header:
  - Property selector
  - Date range
  - Refresh
- KPI row:
  - Active guest sessions
  - New requests
  - Open orders
  - Median response time
- Main grid:
  - Operations queue summary
  - Recent conversations
  - Popular services
  - AI unanswered questions
- Footer panel:
  - Recent activity

### States

- Loading: skeleton đúng hình KPI/chart/list.
- Empty property: onboarding CTA.
- No data: giải thích theo date range.
- Error: retry riêng cho widget nếu có thể.

## A2. Portal Builder

### Layout

- Top command bar:
  - Back
  - Portal status
  - Undo
  - Redo
  - Device
  - Locale
  - Location
  - Preview
  - Publish
- Left panel: component/section library.
- Center: canvas.
- Right panel: inspector.
- Bottom/inline: autosave state.

### Rules

- Không cho kéo section ra ngoài vùng hợp lệ.
- Mỗi section có schema riêng.
- Selection trong canvas đồng bộ inspector.
- Draft autosave debounce.
- Publish luôn explicit.
- Publish validation hiển thị lỗi theo section.
- Không cho publish nếu thiếu required content.

### Required section types

- Hero
- Quick actions
- Explore collections
- Featured services
- Schedule
- Guide links
- Promotion banner
- Assistant callout
- Contact/help

## A3. Knowledge Sources

### Table columns

- Title
- Type
- Source language
- Status
- Chunks
- Updated
- Published
- Actions

### Filters

- Status
- Type
- Language
- Published state

### Actions

- Upload
- Create article
- Reprocess
- Publish/unpublish
- View source
- Delete with impact warning

## A4. Knowledge Search Test

### Layout

- Query input
- Query locale
- Location scope
- Search button
- Retrieval settings drawer
- Results:
  - Combined score
  - Vector score
  - Text score
  - Source
  - Chunk
  - Metadata
- AI answer preview
- Citation preview

### Acceptance

Không chỉ hiển thị câu trả lời AI; phải hiển thị chunks thực tế để debug.

## A5. Requests Operations

### Table/list

- Status
- Type
- Location
- Guest language
- Waiting time
- Assignee
- Created
- Priority

### Detail drawer/page

- Request content
- Timeline
- Guest conversation
- Internal notes
- Assign
- Status actions
- Audit history

## A6. Team Management

- Member list.
- Role.
- Property assignments.
- Invitation.
- Revoke.
- Last active.
- Không cho user tự xóa owner cuối cùng.

---

# B. Staff Screens

## B1. Staff Inbox

### Desktop

- Left: queue list.
- Right: selected item detail.
- Header: property, status, sound/notification, profile.

### Mobile

- Cards with:
  - Type icon
  - Location
  - Summary
  - Waiting time
  - Status
- Primary CTA: Accept.
- Secondary CTA: Open.

### Sorting

1. Priority.
2. Waiting time.
3. Created time.

## B2. Request Detail

- Sticky status header.
- Guest request summary.
- Location.
- Conversation.
- Internal notes.
- Activity timeline.
- Fixed bottom actions on mobile.

## B3. Order Detail

- Item snapshot.
- Options.
- Quantity.
- Price.
- Notes.
- Fulfillment location.
- Payment mode.
- Status progression.
- Chat.

---

# C. Guest Screens

## C1. Guest Homepage

### Above the fold

- Cover.
- Logo.
- Greeting.
- Location label where appropriate.
- Voice/text assistant entry.
- 4–8 quick actions.

### Below

- Explore.
- Featured services.
- Today's schedule.
- Guide.
- Promotion.

### Rules

- Không quá nhiều carousel.
- Primary content phải usable khi ảnh lỗi.
- Brand color phải qua contrast guard.

## C2. Unified Assistant

- Header: assistant name, online/connecting state, close.
- Main: transcript/messages.
- Composer:
  - Text
  - Microphone
  - Attachment if enabled
- Voice state:
  - Idle
  - Requesting permission
  - Connecting
  - Listening
  - Thinking
  - Speaking
  - Reconnecting
  - Error
- Tool confirmation card.
- Handoff state.
- Text fallback luôn khả dụng.

## C3. Service Detail

- Image.
- Name.
- Description.
- Price.
- Availability.
- Options.
- Quantity.
- Notes.
- Add to cart / Request booking.
- Clear unavailable state.

## C4. Request/Order Status

- Current status.
- Timeline.
- Estimated/actual times when available.
- Conversation.
- Cancel action only when state permits.
