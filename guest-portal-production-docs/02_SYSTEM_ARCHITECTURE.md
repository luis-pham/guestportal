# System Architecture

## 1. Kiến trúc cấp cao

```text
Guest Web ───────┐
Admin Web ───────┼──── HTTPS ──── API
Staff Web ───────┘                  │
                                   ├── PostgreSQL + pgvector
                                   ├── Redis + BullMQ
                                   ├── Cloudflare R2
                                   ├── Embedding Service
                                   └── Gemini Tool Gateway

Guest Browser ─── Direct WebSocket ─── Gemini Live
```

## 2. Monorepo

```text
apps/
  guest-web/
  admin-web/
  staff-web/
  api/
  worker/
  embedding-service/

packages/
  auth/
  config/
  contracts/
  db/
  domain/
  tenancy/
  portal/
  knowledge/
  retrieval/
  catalog/
  requests/
  orders/
  conversations/
  ai-tools/
  gemini-live/
  realtime/
  queue/
  storage/
  notifications/
  i18n/
  observability/
  ui/
```

## 3. Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Radix UI
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Zustand
- next-intl
- Playwright

### Backend

- Node.js
- Fastify
- TypeScript
- Zod
- OpenAPI
- Drizzle ORM

### Data

- PostgreSQL
- pgvector
- PostgreSQL FTS
- pg_trgm
- Redis
- BullMQ

### AI

- Gemini Live Native Audio
- Ephemeral token
- Direct browser-to-Gemini
- EmbeddingGemma 300M/308M
- Python FastAPI embedding service
- Hybrid retrieval

### Storage

- Cloudflare R2
- Presigned upload/download
- Public custom assets domain
- Private signed access

## 4. Module boundaries

Mỗi module phải có:

```text
domain/
application/
infrastructure/
http/
tests/
```

Route handler không được chứa business logic.

## 5. Realtime

- PostgreSQL là source of truth.
- Sau transaction thành công, publish domain event.
- Redis Pub/Sub hoặc Streams dùng truyền sự kiện.
- WebSocket gateway push tới Guest hoặc Staff.
- Client mất kết nối phải gọi API để đồng bộ lại.

## 6. Voice

### Bắt buộc

- Audio không đi qua platform backend.
- Backend tạo ephemeral token.
- Browser kết nối Gemini Live.
- Tool call từ Gemini đi qua Platform Tool API.
- Backend validate tenant, permission, payload, state và idempotency.
- AI chỉ tạo draft với hành động gây thay đổi dữ liệu; guest xác nhận trước khi commit.

## 7. RAG

```text
Document in original language
→ parse
→ normalize
→ semantic chunks
→ EmbeddingGemma document embedding
→ PostgreSQL

Guest query in any supported language
→ EmbeddingGemma query embedding
→ vector + FTS + trigram + metadata filter
→ rank
→ return source chunks
→ Gemini answers in guest language
```

## 8. Scale strategy

### Giai đoạn đầu

- 1–2 API replicas.
- 1 realtime process.
- 1–N workers.
- 1 embedding service.
- Managed PostgreSQL.
- Redis managed hoặc self-host có persistence.
- R2.

### Khi tải tăng

Scale riêng:

- guest-web
- api
- realtime
- workers
- embedding-service

Chỉ tách microservice nếu có bằng chứng về tải, ownership hoặc isolation.
