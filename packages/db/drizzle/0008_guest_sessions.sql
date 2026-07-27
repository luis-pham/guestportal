CREATE TABLE IF NOT EXISTS guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  qr_code_id uuid REFERENCES qr_codes(id),
  token_hash text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS guest_sessions_org_idx ON guest_sessions(organization_id);
CREATE INDEX IF NOT EXISTS guest_sessions_property_idx ON guest_sessions(property_id);
CREATE INDEX IF NOT EXISTS guest_sessions_expires_idx ON guest_sessions(expires_at);

ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guest_sessions_tenant_policy ON guest_sessions;
CREATE POLICY guest_sessions_tenant_policy ON guest_sessions
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON guest_sessions TO guestportal_app;
