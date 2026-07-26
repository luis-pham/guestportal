# Deployment and Operations

## 1. Environments

- local
- test
- staging
- production

Không dùng chung database, Redis hoặc R2 bucket giữa staging và production.

## 2. Production topology ban đầu

- Cloudflare DNS/CDN/WAF
- Guest Web
- Admin Web
- Staff Web
- API
- Worker
- Embedding Service
- Managed PostgreSQL
- Redis
- Cloudflare R2
- Gemini API
- Sentry/OpenTelemetry

## 3. CI/CD

```text
install
→ lint
→ typecheck
→ unit
→ integration
→ build
→ migration validation
→ container build
→ staging deploy
→ smoke/e2e
→ manual or policy gate
→ production deploy
```

## 4. Migration

- Expand/contract khi thay đổi lớn.
- Không migration phá dữ liệu.
- Backup trước migration rủi ro.
- Migration có timeout/lock consideration.
- Kiểm tra trên staging data volume gần thực tế.

## 5. Backup

- PostgreSQL automated backup.
- Point-in-time recovery nếu có.
- R2 versioning/lifecycle phù hợp.
- Redis không phải source of truth.
- Restore drill định kỳ.

## 6. Monitoring

- Availability.
- Error rate.
- API latency.
- DB connections.
- Queue backlog.
- Failed jobs.
- WebSocket connections.
- RAG latency/no-result.
- Voice session success.
- R2 errors.
- Tenant-specific anomaly.

## 7. Incident readiness

- Runbook.
- Severity.
- On-call contact.
- Rollback.
- Feature flag.
- Disable voice/AI/tool mutation.
- Disable property portal.
- Revoke QR token.
- Revoke staff session.
