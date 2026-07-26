# Phase 00 — Repository and Engineering Foundation

## Mục tiêu

Tạo nền tảng repo production-ready.

## Scope

- pnpm + Turborepo.
- TypeScript strict.
- ESLint/Prettier.
- Environment validation.
- Docker local.
- Testcontainers foundation.
- GitHub Actions.
- Shared config.
- Conventional commit hoặc commit policy.
- Base logging/observability.
- Documentation structure.

## Acceptance criteria

- Tất cả app/package build được.
- `lint`, `typecheck`, `test`, `build` chạy từ root.
- Docker local chạy PostgreSQL, Redis và storage test.
- Không có secret trong repo.
- CI chạy trên pull request.
- Có sample env không chứa secret.

## Test bắt buộc

- Clean install.
- Root build.
- Root lint.
- Root typecheck.
- Unit smoke.
- Docker health.
- CI dry run hoặc actual run.

## UI/UX

Chưa cần màn hình hoàn thiện, nhưng phải có design-system app shell placeholder đúng token, không dùng UI ngẫu nhiên.

## Gate

Không chuyển Phase 01 nếu root pipeline chưa PASS.
