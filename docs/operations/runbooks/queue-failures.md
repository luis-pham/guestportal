# Queue Failures Runbook

1. Group failed jobs by queue, error code, and source type.
2. Verify malformed files are isolated to the owning tenant.
3. Requeue only idempotent jobs after fixing the root cause.
4. Keep failed payloads out of shared logs unless redacted.
