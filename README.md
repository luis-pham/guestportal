# GuestPortal

Production-ready QR Guest Portal platform for hotels, resorts, cruises, Airbnb, and related hospitality services.

## Apps

| App | Port | Purpose |
|---|---|---|
| `apps/guest-web` | 3000 | Guest portal |
| `apps/admin-web` | 3001 | Admin portal |
| `apps/staff-web` | 3002 | Staff workspace |
| `apps/api` | 4000 | Platform API |
| `apps/worker` | — | Background jobs |
| `apps/embedding-service` | 4100 | EmbeddingGemma service |

## Prerequisites

- Node.js 22+
- pnpm 11+
- Docker Desktop (Postgres, Redis, MinIO)
- Python 3.11+ (embedding service)

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm docker:health
pnpm build
pnpm test
```

## Root scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm phase:run 00
pnpm phase:verify 00
```

## Documentation

Canonical implementation specs live in [`guest-portal-production-docs/`](./guest-portal-production-docs/README.md).

Product/tech research notes:

- `docs/lotavi_description.docx`
- `docs/Tech Stack Đề Xuất Cho Nền Tảng QR Guest Portal.docx`

## Phase status

Phase 00 establishes the engineering foundation. Do not start Phase 01 until `pnpm phase:verify 00` reports `PASS` (or documents an accepted `BLOCKED` external prerequisite).
