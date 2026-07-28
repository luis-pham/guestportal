# Realtime Errors Runbook

1. Check realtime connection errors and reconnect rate.
2. Verify auth cookie/session and property assignment failures are expected denials.
3. Compare outbox replay latency with API and DB panels.
4. Roll back if reconnect loops started after the latest deploy.
