# Research Notes and Primary Sources

These references informed the implementation constraints. Check current versions during implementation.

- Gemini Live ephemeral tokens: designed for short-lived WebSocket access from user devices.
- Cloudflare R2 presigned URLs: temporary operation-specific object access without exposing credentials.
- Fastify: schema-based request validation and response serialization.
- Next.js App Router: file-system routing and server/client component model.
- PostgreSQL RLS: default deny when enabled without applicable policy; use FORCE RLS where appropriate.
- Playwright: HTML reports, traces and screenshot support.
- Storybook: component, visual and accessibility testing.
- WCAG 2.2: target for core accessibility flows.
- pgvector: HNSW/vector indexing and filtered-search considerations.

The implementation agent must consult official documentation for the pinned dependency versions rather than copying examples blindly.
