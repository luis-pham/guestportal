# API Latency Runbook

1. Compare API p95 latency against DB connection and queue backlog panels.
2. Identify the slow route and correlate by deployment timestamp.
3. Disable expensive optional paths when available and rollback if core workflow latency remains above target.
4. Open a performance follow-up with route, p95, sample count, and affected tenant scope.
