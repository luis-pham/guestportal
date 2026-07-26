# API Contracts

## 1. Contract rules

- REST JSON over HTTPS.
- OpenAPI is generated and version-controlled.
- Fastify route schema validates request and serializes response.
- No response shape may be changed without versioning or coordinated migration.
- Every error uses one envelope.
- Mutations use idempotency where specified.
- Pagination defaults to cursor-based for large lists.

## 2. Error envelope

```json
{
  "error": {
    "code": "REQUEST_NOT_FOUND",
    "message": "Request not found.",
    "requestId": "req_trace_id",
    "details": {}
  }
}
```

User-facing message is localized in frontend by `code`; backend message is diagnostic and safe.

## 3. Common headers

- `Authorization`
- `Idempotency-Key`
- `X-Request-Id`
- `Accept-Language`

## 4. Core endpoints

### Authentication and context

```text
GET  /v1/me
GET  /v1/me/memberships
POST /v1/auth/logout
```

### Organizations

```text
GET    /v1/organizations
POST   /v1/organizations
GET    /v1/organizations/:organizationId
PATCH  /v1/organizations/:organizationId
```

### Properties

```text
GET    /v1/properties
POST   /v1/properties
GET    /v1/properties/:propertyId
PATCH  /v1/properties/:propertyId
```

### Portal

```text
GET  /v1/properties/:propertyId/portal/draft
PUT  /v1/properties/:propertyId/portal/draft
POST /v1/properties/:propertyId/portal/validate
POST /v1/properties/:propertyId/portal/publish
GET  /v1/properties/:propertyId/portal/versions
POST /v1/properties/:propertyId/portal/versions/:versionId/restore
```

### Upload/R2

```text
POST /v1/uploads/presign
POST /v1/uploads/complete
GET  /v1/assets/:assetId
DELETE /v1/assets/:assetId
```

Presign request:

```json
{
  "purpose": "knowledge_source",
  "filename": "guide.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1200000,
  "propertyId": "..."
}
```

Response:

```json
{
  "assetId": "...",
  "method": "PUT",
  "uploadUrl": "...",
  "requiredHeaders": {
    "Content-Type": "application/pdf"
  },
  "expiresAt": "..."
}
```

### Knowledge

```text
GET    /v1/properties/:propertyId/knowledge-sources
POST   /v1/properties/:propertyId/knowledge-sources
GET    /v1/properties/:propertyId/knowledge-sources/:sourceId
PATCH  /v1/properties/:propertyId/knowledge-sources/:sourceId
POST   /v1/properties/:propertyId/knowledge-sources/:sourceId/process
POST   /v1/properties/:propertyId/knowledge-sources/:sourceId/publish
POST   /v1/properties/:propertyId/knowledge/search
```

### Catalog

```text
GET/POST/PATCH /v1/properties/:propertyId/categories
GET/POST/PATCH /v1/properties/:propertyId/products
GET/POST/PATCH /v1/properties/:propertyId/services
```

### Guest session

```text
POST /v1/guest/resolve-qr
POST /v1/guest/sessions
GET  /v1/guest/session
POST /v1/guest/live-sessions
```

Resolve QR response includes only public portal context.

### Conversations

```text
POST /v1/guest/conversations
GET  /v1/guest/conversations/:conversationId
POST /v1/guest/conversations/:conversationId/messages
POST /v1/guest/conversations/:conversationId/tool-results
POST /v1/guest/conversations/:conversationId/handoff
```

### Requests

```text
POST /v1/guest/request-drafts
POST /v1/guest/request-drafts/:draftId/confirm
GET  /v1/guest/requests
GET  /v1/guest/requests/:requestId
POST /v1/guest/requests/:requestId/cancel

GET  /v1/staff/requests
POST /v1/staff/requests/:requestId/claim
POST /v1/staff/requests/:requestId/start
POST /v1/staff/requests/:requestId/complete
POST /v1/staff/requests/:requestId/reject
```

### Orders

```text
POST /v1/guest/carts
PUT  /v1/guest/carts/:cartId/items
POST /v1/guest/orders
GET  /v1/guest/orders/:orderId
POST /v1/guest/orders/:orderId/cancel

GET  /v1/staff/orders
POST /v1/staff/orders/:orderId/claim
POST /v1/staff/orders/:orderId/confirm
POST /v1/staff/orders/:orderId/prepare
POST /v1/staff/orders/:orderId/ready
POST /v1/staff/orders/:orderId/deliver
POST /v1/staff/orders/:orderId/complete
```

## 5. Concurrency rules

- Claim uses conditional update and returns `409 ALREADY_CLAIMED`.
- State transitions check current version/status.
- Mutable entities have optimistic version where appropriate.
- Duplicate idempotency key returns original result.

## 6. Rate limits

Separate limits for:

- QR resolution.
- Guest session creation.
- Gemini token creation.
- Message send.
- Upload presign.
- Search knowledge.
- Request/order mutation.
