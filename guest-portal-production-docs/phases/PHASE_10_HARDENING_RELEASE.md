# Phase 10 — Production Hardening and Release

## Scope

- Security review.
- Performance.
- Load.
- Backup/restore.
- Disaster recovery.
- Monitoring/alerts.
- CI/CD production.
- Runbook.
- Feature flags.
- Data retention.
- Release checklist.

## Acceptance criteria

- No S0/S1.
- Restore drill thành công.
- Migration rehearsal.
- Load target đạt.
- Alerts hoạt động.
- Rollback được.
- Production secrets đúng.
- R2 private/public policy đúng.
- Monitoring dashboard.
- Full regression VI/EN.
- Guest core locales smoke.

## Test bắt buộc

- Full unit/integration/e2e.
- Security suite.
- Tenant isolation suite.
- Lighthouse.
- Load test.
- Queue failure/recovery.
- DB fail/restart drill phù hợp.
- Backup restore.
- Production-like staging smoke.
- Manual UX review checklist.

## Release gate

Chỉ release khi `RELEASE_RESULT.md` có đầy đủ evidence và sign-off.
