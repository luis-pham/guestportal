-- Unset current_setting(..., true) returns NULL, which does not equal ''.
-- Default the GUC so bootstrap/login paths see rows; SET LOCAL in
-- withTenantTransaction still scopes per-request work.
ALTER ROLE guestportal_app SET app.organization_id = '';
ALTER ROLE guestportal_app SET app.user_id = '';

-- Also treat NULL like '' in policies for connections that never inherit role defaults.
DROP POLICY IF EXISTS organizations_tenant_policy ON organizations;
CREATE POLICY organizations_tenant_policy ON organizations
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

DROP POLICY IF EXISTS properties_tenant_policy ON properties;
CREATE POLICY properties_tenant_policy ON properties
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

DROP POLICY IF EXISTS memberships_tenant_policy ON organization_memberships;
CREATE POLICY memberships_tenant_policy ON organization_memberships
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

DROP POLICY IF EXISTS property_assignments_tenant_policy ON property_assignments;
CREATE POLICY property_assignments_tenant_policy ON property_assignments
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

DROP POLICY IF EXISTS audit_logs_tenant_policy ON audit_logs;
CREATE POLICY audit_logs_tenant_policy ON audit_logs
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id IS NULL
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id IS NULL
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );
