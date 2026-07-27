CREATE TABLE IF NOT EXISTS portal_templates (
  id text PRIMARY KEY,
  property_type text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_templates_property_type_idx ON portal_templates(property_type);

CREATE TABLE IF NOT EXISTS portal_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  version integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

CREATE INDEX IF NOT EXISTS portal_drafts_org_idx ON portal_drafts(organization_id);

ALTER TABLE portal_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_drafts_tenant_policy ON portal_drafts;
CREATE POLICY portal_drafts_tenant_policy ON portal_drafts
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON portal_drafts TO guestportal_app;
GRANT SELECT ON portal_templates TO guestportal_app;
