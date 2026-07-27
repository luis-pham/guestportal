CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid REFERENCES properties(id),
  bucket text NOT NULL,
  object_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum_sha256 text,
  visibility text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'pending',
  purpose text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, object_key)
);

CREATE INDEX IF NOT EXISTS assets_org_idx ON assets(organization_id);
CREATE INDEX IF NOT EXISTS assets_property_idx ON assets(property_id);
CREATE INDEX IF NOT EXISTS assets_status_idx ON assets(status);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_tenant_policy ON assets;
CREATE POLICY assets_tenant_policy ON assets
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON assets TO guestportal_app;
