# Domain and Data Model

## 1. Quy tắc chung

- UUID/ULID cho primary key.
- Tất cả bảng tenant phải có `organization_id`.
- Bảng thuộc property phải có `property_id`.
- Không dùng soft delete tùy tiện; phải định nghĩa retention rõ.
- Mọi mutation quan trọng có audit log.
- Timestamp dùng UTC.
- Hiển thị theo timezone property.

## 2. Entity chính

### Organization

- id
- name
- slug
- status
- default_locale
- created_at
- updated_at

### Property

- id
- organization_id
- type
- name
- slug
- timezone
- currency
- default_locale
- supported_locales
- status
- created_at
- updated_at

### Location

- id
- organization_id
- property_id
- parent_id
- type
- code
- name
- metadata
- status

### QRCode

- id
- organization_id
- property_id
- location_id
- public_token_hash
- destination_type
- destination_id
- enabled
- scan_count
- last_scanned_at

### GuestSession

- id
- organization_id
- property_id
- location_id
- locale
- status
- expires_at
- last_seen_at
- metadata

### PortalConfig

- id
- organization_id
- property_id
- version
- status
- config_json
- published_at
- created_by

### KnowledgeSource

- id
- organization_id
- property_id
- type
- title
- source_language
- r2_object_key
- checksum
- version
- status
- error_message

### KnowledgeChunk

- id
- organization_id
- property_id
- source_id
- content
- heading_path
- source_language
- metadata
- content_tsv
- embedding vector(768)
- active
- version

### Product / Service

- id
- organization_id
- property_id
- category_id
- type
- name
- description
- active
- visibility
- base_price
- currency
- image_asset_id

### Request

- id
- organization_id
- property_id
- location_id
- guest_session_id
- conversation_id
- category
- status
- priority
- payload
- assigned_staff_id
- submitted_at
- completed_at
- idempotency_key

### Order

- id
- organization_id
- property_id
- location_id
- guest_session_id
- conversation_id
- status
- currency
- subtotal
- total
- payment_mode
- assigned_staff_id
- submitted_at
- completed_at
- idempotency_key

### Conversation

- id
- organization_id
- property_id
- guest_session_id
- status
- locale
- handed_off_at

### Message

- id
- conversation_id
- role
- source
- original_language
- original_text
- translated_text
- tool_name
- tool_payload
- request_id
- order_id
- created_at

### StaffUser / Membership

- user
- organization_membership
- property_assignment
- role
- permissions

## 3. State transition

State transition phải được thực thi bởi domain service, không update tự do.

### Request

```text
draft → submitted
submitted → accepted | rejected | cancelled
accepted → in_progress | cancelled
in_progress → completed | cancelled
```

### Order

```text
draft → submitted
submitted → confirmed | cancelled
confirmed → preparing | cancelled
preparing → ready | cancelled
ready → delivering | completed | cancelled
delivering → completed | cancelled
```

## 4. Idempotency

Các mutation sau bắt buộc hỗ trợ idempotency:

- confirm request
- submit order
- confirm order
- complete request/order
- webhook
- ingestion job
- translation job
- notification delivery

## 5. Tenant isolation

Mỗi repository nhận `TenantContext` bắt buộc:

```ts
type TenantContext = {
  organizationId: string;
  propertyIds?: string[];
  actorId?: string;
  actorType: "guest" | "staff" | "system";
};
```

Repository không có method query toàn bộ tenant trừ module platform administration riêng.
