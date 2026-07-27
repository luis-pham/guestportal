CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  type text NOT NULL,
  title text NOT NULL,
  source_language text,
  asset_id uuid REFERENCES assets(id),
  r2_object_key text,
  checksum_sha256 text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  error_code text,
  error_message text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sources_property_status_idx
  ON knowledge_sources(organization_id, property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_sources_asset_idx ON knowledge_sources(asset_id);

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_sources_tenant_policy ON knowledge_sources;
CREATE POLICY knowledge_sources_tenant_policy ON knowledge_sources
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_sources TO guestportal_app;
