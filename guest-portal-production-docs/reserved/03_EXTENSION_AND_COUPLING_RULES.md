# Future Extension and Coupling Rules

## Required dependency direction

```text
Guest / Staff / Admin feature
        ↓
Application capability check (optional seam)
        ↓
CapabilityResolver interface
        ↓
Future entitlement implementation (RESERVED)
        ↓
Future subscription or billing source (RESERVED)
```

## Current modules must not depend on

- plan codes;
- prices;
- subscription records;
- payment-provider SDKs;
- invoices;
- operator-only Platform Admin UI;
- commercial usage counters.

## Stable identifiers

Continue using stable tenant identifiers:

- `organizationId`
- `propertyId`
- `locationId` where applicable

Do not add `planId`, `subscriptionId`, `billingCustomerId` or payment-provider identifiers to current domain entities until a future schema specification requires them.

## Safe future seams

Where technically necessary, use:

- provider-neutral interfaces;
- dependency injection;
- events that describe product activity rather than billing intent;
- audit metadata that already belongs to the current product;
- module boundaries that prevent direct imports from future commercial modules.

## Event rule

Current events may state facts such as `voice.session.completed` or `knowledge.document.processed`. They must not emit speculative events such as `invoice.chargeable_usage_added` without an approved future specification.
