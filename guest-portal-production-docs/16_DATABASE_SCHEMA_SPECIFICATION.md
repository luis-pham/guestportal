# Database Schema Specification

## 1. Database standards

- PostgreSQL.
- `uuid` or ULID-compatible UUID.
- UTC timestamps.
- `created_at`, `updated_at`.
- Foreign keys explicit.
- `ON DELETE` behavior explicit.
- Unique constraints explicit.
- RLS enabled on tenant tables.
- Application service role must not bypass RLS accidentally.
- Database owner role is not used by runtime application.

## 2. Core tenant tables

### organizations

```sql
CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('active','suspended','deleted')),
  default_locale text NOT NULL DEFAULT 'vi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### properties

```sql
CREATE TABLE properties (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type text NOT NULL CHECK (type IN (
    'hotel','resort','cruise','airbnb',
    'serviced_apartment','restaurant','spa','other'
  )),
  name text NOT NULL,
  slug text NOT NULL,
  timezone text NOT NULL,
  currency char(3) NOT NULL,
  default_locale text NOT NULL,
  supported_locales text[] NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX properties_org_idx ON properties(organization_id);
```

## 3. Runtime mutation standards

### requests

Required constraints:

- Unique `(organization_id, idempotency_key)` when key not null.
- Status check.
- `completed_at` required only for completed state enforced in domain plus DB check where practical.
- Index `(organization_id, property_id, status, created_at DESC)`.
- Index for assignee/work queue.
- Version integer for optimistic concurrency.

### orders

- Store total in smallest currency unit integer.
- Snapshot product name, price and selected options in order item.
- Never recalculate historical order from current catalog.
- Unique idempotency key.
- State/version index.

## 4. Assets

`assets` stores metadata, never raw binary:

- organization_id
- property_id nullable
- bucket
- object_key
- original_filename
- mime_type
- size_bytes
- checksum_sha256
- visibility
- status
- purpose
- created_by

Unique bucket/object key.

## 5. Knowledge

### knowledge_sources

- Status state machine.
- Checksum/version.
- Asset reference.
- Parser version.
- Embedding model/version.
- Error code/message.

### knowledge_chunks

Indexes:

- Tenant/property/active.
- GIN FTS.
- Trigram only on fields needing fuzzy matching.
- HNSW vector.
- Source/version.

Vector retrieval tests must account for metadata filtering and verify sufficient recall.

## 6. RLS model

At transaction start, application sets scoped values:

```sql
SET LOCAL app.organization_id = '...';
SET LOCAL app.user_id = '...';
```

Example policy:

```sql
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests FORCE ROW LEVEL SECURITY;

CREATE POLICY requests_tenant_policy
ON requests
USING (
  organization_id = current_setting('app.organization_id', true)::uuid
)
WITH CHECK (
  organization_id = current_setting('app.organization_id', true)::uuid
);
```

Additional property permission is applied by application/repository or policy with property assignments.

## 7. Migration rules

- Migration file immutable after merged.
- Forward-only production.
- Destructive changes use expand/contract.
- Backfill is a resumable job.
- Large index created concurrently when supported.
- Migration test runs from empty DB and upgraded fixture DB.
