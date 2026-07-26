# Event and Job Catalog

## 1. Event rules

- Event name versioned.
- Event emitted after committed transaction using outbox pattern where reliability matters.
- Consumer idempotent.
- Event contains IDs, not large payloads.
- Tenant context mandatory.
- PII minimized.

## 2. Domain events

| Event | Producer | Consumers |
|---|---|---|
| `portal.published.v1` | Portal module | Cache invalidation, analytics |
| `qr.scanned.v1` | Guest module | Analytics |
| `guest.session_started.v1` | Guest module | Analytics |
| `knowledge.source_created.v1` | Knowledge | Ingestion worker |
| `knowledge.ingestion_completed.v1` | Worker | Admin realtime, analytics |
| `conversation.message_created.v1` | Conversation | Realtime, notification |
| `conversation.handoff_requested.v1` | Conversation | Staff inbox |
| `request.submitted.v1` | Request | Staff inbox, realtime |
| `request.status_changed.v1` | Request | Guest realtime, analytics |
| `order.submitted.v1` | Order | Staff inbox |
| `order.status_changed.v1` | Order | Guest realtime, analytics |
| `staff.assignment_changed.v1` | Operations | Realtime, notification |

## 3. Standard event envelope

```json
{
  "eventId": "uuid",
  "eventName": "request.submitted.v1",
  "occurredAt": "ISO-8601",
  "organizationId": "uuid",
  "propertyId": "uuid",
  "actor": {
    "type": "guest",
    "id": "uuid"
  },
  "resource": {
    "type": "request",
    "id": "uuid"
  },
  "traceId": "..."
}
```

## 4. Queues

- `knowledge-ingestion`
- `embedding`
- `translation`
- `image-processing`
- `notifications`
- `analytics-rollup`
- `webhook-delivery`
- `cleanup`
- `conversation-summary`

## 5. Job contract

Every job:

- `jobVersion`
- `organizationId`
- `propertyId`
- `resourceId`
- `idempotencyKey`
- `traceId`
- `attempt metadata`

## 6. Retry policy

- Retry only transient errors.
- Permanent validation errors fail without retry.
- Exponential backoff + jitter.
- Max attempts documented per queue.
- Dead-letter record inspectable.
- Manual requeue audited.

## 7. Outbox

For request/order/message events:

1. Business row and outbox row committed in same transaction.
2. Publisher claims outbox.
3. Publishes to Redis/realtime pipeline.
4. Marks published.
5. Duplicate consumer delivery is expected and safe.
