# Database Connections Runbook

1. Check active connections, waiting queries, and recent deploys.
2. Confirm workers are not creating unexpected connection fan-out.
3. Restart only the affected GuestPortal process group if connection leaks are confirmed.
4. Preserve `schema_migrations` and take a backup before risky DB intervention.
