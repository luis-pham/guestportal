CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  default_locale text NOT NULL DEFAULT 'vi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS properties_org_idx ON properties(organization_id);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  locale text NOT NULL DEFAULT 'vi',
  status text NOT NULL DEFAULT 'active',
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON organization_memberships(user_id);

CREATE TABLE IF NOT EXISTS property_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, user_id)
);
CREATE INDEX IF NOT EXISTS property_assignments_user_idx ON property_assignments(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_tenant_policy ON organizations;
CREATE POLICY organizations_tenant_policy ON organizations
  USING (
    current_setting('app.organization_id', true) = ''
    OR id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) = ''
    OR id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS properties_tenant_policy ON properties;
CREATE POLICY properties_tenant_policy ON properties
  USING (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memberships_tenant_policy ON organization_memberships;
CREATE POLICY memberships_tenant_policy ON organization_memberships
  USING (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_assignments_tenant_policy ON property_assignments;
CREATE POLICY property_assignments_tenant_policy ON property_assignments
  USING (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant_policy ON audit_logs;
CREATE POLICY audit_logs_tenant_policy ON audit_logs
  USING (
    current_setting('app.organization_id', true) = ''
    OR organization_id IS NULL
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.organization_id', true) = ''
    OR organization_id IS NULL
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );
