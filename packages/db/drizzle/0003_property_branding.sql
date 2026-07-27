CREATE TABLE IF NOT EXISTS property_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);
CREATE INDEX IF NOT EXISTS property_branding_org_idx ON property_branding(organization_id);

ALTER TABLE property_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_branding FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_branding_tenant_policy ON property_branding;
CREATE POLICY property_branding_tenant_policy ON property_branding
  USING (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );
