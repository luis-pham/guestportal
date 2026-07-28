# API Error Rate Runbook

1. Inspect error-rate panel by service and route.
2. Review redacted structured logs by `requestId`.
3. Check recent deploys, DB connectivity, R2 errors, and upstream AI/service failures.
4. Escalate as S1 when core guest, staff, or admin workflows return 5xx.
