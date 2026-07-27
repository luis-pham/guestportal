CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  parent_id uuid REFERENCES locations(id),
  type text NOT NULL DEFAULT 'area',
  code text NOT NULL,
  name jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);

CREATE INDEX IF NOT EXISTS locations_org_idx ON locations(organization_id);
CREATE INDEX IF NOT EXISTS locations_property_idx ON locations(property_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locations_tenant_policy ON locations;
CREATE POLICY locations_tenant_policy ON locations
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  public_token text NOT NULL,
  public_token_hash text NOT NULL,
  destination_type text NOT NULL DEFAULT 'portal_home',
  destination_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  scan_count bigint NOT NULL DEFAULT 0,
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_token),
  UNIQUE (public_token_hash)
);

CREATE INDEX IF NOT EXISTS qr_codes_org_idx ON qr_codes(organization_id);
CREATE INDEX IF NOT EXISTS qr_codes_property_idx ON qr_codes(property_id);
CREATE INDEX IF NOT EXISTS qr_codes_location_idx ON qr_codes(location_id);

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qr_codes_tenant_policy ON qr_codes;
CREATE POLICY qr_codes_tenant_policy ON qr_codes
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON qr_codes TO guestportal_app;
