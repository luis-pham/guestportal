CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  content text NOT NULL,
  heading_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_language text NOT NULL,
  content_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED,
  embedding vector(768),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_source_version_ordinal_uidx
  ON knowledge_chunks(source_id, version, ordinal);

CREATE INDEX IF NOT EXISTS knowledge_chunks_active_lookup_idx
  ON knowledge_chunks(organization_id, property_id, source_id, active, version);

CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
  ON knowledge_chunks USING GIN (content_tsv);

CREATE INDEX IF NOT EXISTS knowledge_chunks_trgm_idx
  ON knowledge_chunks USING GIN (content gin_trgm_ops);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_chunks_tenant_policy ON knowledge_chunks;
CREATE POLICY knowledge_chunks_tenant_policy ON knowledge_chunks
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_chunks TO guestportal_app;

ALTER TABLE knowledge_sources
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_model_version text;
