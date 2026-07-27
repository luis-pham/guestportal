# Reserved Architecture Agent Checklist

Before every task from Phase 02 onward, confirm:

- [ ] The task does not implement Platform Admin, plans, pricing, subscription or billing.
- [ ] No plan name, price, payment provider or quota was invented.
- [ ] No current product module imports a future commercial module.
- [ ] Tenant-facing Admin remains separate from future operator Platform Admin.
- [ ] Organization and property context remain intact.
- [ ] Any capability seam is provider-neutral and justified by the current task.
- [ ] No speculative tables, routes, screens or empty applications were created.
- [ ] Any blocked deferred decision is recorded in `TASK_RESULT.md`.

Add this section to every task result:

```text
Reserved Architecture Check: PASS | FAIL | BLOCKED
Deferred decisions touched: none | <list>
Speculative commercial logic introduced: no | <details>
```
