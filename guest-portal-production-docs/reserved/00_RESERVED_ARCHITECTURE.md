# Reserved Architecture — Mandatory Guardrail

## Status

This document is effective **before Phase 02**. It does not add, remove, split, merge, or renumber any phase. The roadmap remains Phase 00 through Phase 10.

## Purpose

The product will later require platform-level administration, commercial plans, subscriptions, usage limits, billing, payment collection, and related operations. Those business details are intentionally **not decided yet**.

These capabilities are not missing requirements. They are **RESERVED** future modules.

Current implementation must preserve clean extension points without inventing future business rules.

## Reserved modules

- Platform Admin owned by the SaaS operator
- Customer provisioning and assignment
- Plan catalog and pricing
- Subscription lifecycle
- Entitlement and feature-limit policy
- Usage metering for commercial purposes
- Billing, invoices, taxes, payment collection and reconciliation
- Payment providers, including Vietnamese payment methods
- Customer self-service billing
- Partner, reseller and marketplace modules

## Mandatory rule

For all Phase 02–10 tasks:

1. Do not implement reserved business logic.
2. Do not invent plans, prices, quotas, payment flows or subscription states.
3. Do not couple guest, staff, property, knowledge, voice, request or order modules directly to a plan name or payment provider.
4. Preserve organization and property boundaries already defined by the canonical architecture.
5. Use neutral extension interfaces only when the current task genuinely needs a future-access seam.
6. Do not create speculative database tables, routes, screens, packages or placeholder applications merely to represent future modules.
7. If a task cannot proceed without a deferred business decision, mark only that task `BLOCKED` and document the decision required.

## Minimal allowed extension seam

Application code that may eventually depend on commercial access must depend on a provider-neutral capability contract, not on billing:

```ts
export type CapabilityKey = string;

export interface CapabilityContext {
  organizationId: string;
  propertyId?: string;
}

export interface CapabilityResolver {
  isEnabled(context: CapabilityContext, capability: CapabilityKey): Promise<boolean>;
  getLimit(context: CapabilityContext, capability: CapabilityKey): Promise<number | null>;
}
```

This is an architectural seam, not a requirement to implement plans or billing now. Until a future specification activates it, the system may use a documented default resolver that enables only capabilities already in the current phase scope.

## Forbidden examples

```ts
if (organization.plan === "pro") { /* ... */ }
if (subscription.status === "paid") { /* ... */ }
if (provider === "vnpay") { /* ... */ }
```

These patterns are forbidden outside a future approved commercial-module specification.

## Activation rule

A reserved module becomes implementable only when the project owner supplies a new approved specification containing its domain model, lifecycle, permissions, APIs, screens, tests, migration plan and task manifests.
