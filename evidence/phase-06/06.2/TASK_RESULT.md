# Task 06.2 — Validated AI tool gateway

## Result

**PASS**

## Dependency

Task 06.1 `PASS`

## Delivered

- Added shared AI tool contracts for `knowledge.search`, `catalog.read`, and `service.read` with explicit input, output, scope, request, and response schemas.
- Added `@guestportal/ai-tools`, a read-only tool gateway that validates scope, input, and output around every tool execution.
- Added structured fail-closed errors:
  - `AI_TOOL_UNAUTHORIZED`
  - `AI_TOOL_INPUT_INVALID`
  - `AI_TOOL_OUTPUT_INVALID`
- Added guest API endpoint:
  - `POST /v1/guest/conversations/:conversationId/tool-results`
- Enforced conversation, guest session, organization, and property scope from backend session state.
- Persisted validated tool results into the conversation transcript as `role = tool` messages.
- Wired read-only handlers for scoped RAG search and published portal catalog/service reads.

## Tests / evidence

- AI tools test — `ai-tools-test.log` (`4 passed`)
- AI tools typecheck — `ai-tools-typecheck.log`
- AI tools lint — `ai-tools-lint.log`
- AI tools build — `ai-tools-build.log`
- Contracts test — `contracts-test.log` (`21 passed`)
- Contracts typecheck — `contracts-typecheck.log`
- Contracts lint — `contracts-lint.log`
- Contracts build — `contracts-build.log`
- API integration — `api-integration.log` (`30 passed`)
- API typecheck — `api-typecheck.log`
- API lint — `api-lint.log`
- API build — `api-build.log`

## VPS validation

- Pending push/pull validation.

## Acceptance

- [x] Every registered tool validates input before execution.
- [x] Every registered tool validates and strips output before returning/persisting.
- [x] Unknown or unavailable tools fail closed with structured authorization errors.
- [x] Tool execution scope is derived from the resolved guest session and locked conversation, not request-supplied tenant ids.
- [x] RAG, catalog, and service reads are constrained to the conversation's organization and property.
- [x] Malformed handler output returns `AI_TOOL_OUTPUT_INVALID` instead of leaking raw output.
- [x] Integration coverage includes unauthorized call, tenant/session isolation, malformed input, scoped RAG read, catalog read, and transcript persistence.

## Reserved Architecture Check

- [x] No platform admin, plan, billing, subscription, quota, or commercial logic added.
- [x] No mutation-capable AI tools added.
- [x] No direct unscoped DB access exposed to the model or client.
- [x] Tool scope is backend-controlled and tenant/property bounded.

## Scope notes

- Task-required evidence is stored under `evidence/phase-06/06.2/`.
- Confirmation protocols and mutation tools remain out of scope for this task.

## Classification

**PASS**
