# Platform Boundary Reservation

## Current product boundary

The current 11 phases build tenant-facing product capabilities:

```text
SaaS Platform Boundary
  └── Organization
       └── Property
            ├── Admin Portal
            ├── Staff Workspace
            └── Guest Portal
```

## Future platform boundary

A future operator-only application may provision and manage organizations, properties, commercial access and account lifecycle. It is separate from the tenant Admin Portal.

```text
Future Platform Admin (RESERVED)
  ├── Organization provisioning
  ├── Property assignment
  ├── Owner assignment
  ├── Commercial plan assignment
  ├── Subscription and payment operations
  └── Operator audit and support actions
```

## Guardrails

- Tenant Admin users must never gain operator-level access through existing RBAC roles.
- Operator roles must not be added to tenant role enums without a future approved migration.
- `/admin/*` remains tenant administration.
- `/staff/*` remains property operations.
- `/guest/*` remains guest-facing.
- `/platform/*` is reserved and must not be exposed or implemented now.
- Existing tenant APIs must continue to require organization/property context.
- Do not place future billing or operator fields on UI forms in current phases.
