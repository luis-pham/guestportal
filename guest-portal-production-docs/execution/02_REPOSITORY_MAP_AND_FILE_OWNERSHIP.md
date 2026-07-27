# Repository Map and File Ownership

The exact repository may differ. The agent must map actual paths to these logical owners in the Phase 01 baseline report. Do not create duplicate packages merely because a suggested path differs.

| Logical area | Preferred paths | Primary owner phase | Notes |
|---|---|---:|---|
| Shared UI primitives | `packages/ui/**` | 02 | Tokens, primitives, Storybook, accessibility |
| Admin application | `apps/admin/**` | 02,03,05,09 | Shell in 02; feature screens in later phases |
| Staff application | `apps/staff/**` | 02,08 | Shell in 02; operations in 08 |
| Guest application | `apps/guest/**` | 04,06,07,08 | Public guest experience |
| API application | `apps/api/**` | all backend phases | Fastify routes and composition |
| Workers | `apps/worker/**` | 05,08,10 | BullMQ processors only |
| Database | `packages/db/**` | 01,03,04,05,06,08,09 | Drizzle schema and migrations |
| Auth and tenancy | `packages/auth/**`, `packages/tenancy/**` | 01 | Frozen baseline except justified fixes |
| Contracts | `packages/contracts/**` | all | Shared Zod/OpenAPI contracts |
| Storage | `packages/storage/**` | 03,05 | R2 client and presigned flows |
| RAG | `packages/rag/**` | 05,06 | Parsing, chunking, embedding, retrieval |
| AI tools | `packages/ai-tools/**` | 06,07 | Validated tool gateway; no direct mutation |
| Realtime | `packages/realtime/**` | 08 | Events/WebSocket contracts |
| Analytics | `packages/analytics/**` | 09 | Tenant-scoped query services |
| Observability | `packages/observability/**` | 00,10 | Logs, metrics, tracing, alerts |
| E2E tests | `tests/e2e/**` | all | Playwright and visual evidence |
| Integration tests | `tests/integration/**` | all | Real DB and service boundaries |
| Evidence | `evidence/**` | all | Generated, immutable per task run |

## Ownership rules

- A task may modify only its `Allowed paths`.
- `Read-only paths` may be inspected but not changed.
- Any required change outside allowed paths must be listed under `Scope exception` in the task report before editing.
- Files owned by a future phase must not be implemented early.
- Do not place business logic in page components when a domain/service owner exists.
- Do not duplicate contracts across applications.
