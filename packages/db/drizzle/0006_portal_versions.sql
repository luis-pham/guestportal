CREATE TABLE IF NOT EXISTS portal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  version_number integer NOT NULL,
  config jsonb NOT NULL,
  checksum_sha256 text NOT NULL,
  published_by uuid REFERENCES users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  restored_from_version_id uuid REFERENCES portal_versions(id),
  note text,
  UNIQUE (property_id, version_number)
);

CREATE INDEX IF NOT EXISTS portal_versions_property_idx ON portal_versions(property_id);
CREATE INDEX IF NOT EXISTS portal_versions_org_idx ON portal_versions(organization_id);

ALTER TABLE portal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portal_versions_tenant_policy ON portal_versions;
CREATE POLICY portal_versions_tenant_policy ON portal_versions
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx ON outbox_events(created_at)
  WHERE published_at IS NULL;

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_events_tenant_policy ON outbox_events;
CREATE POLICY outbox_events_tenant_policy ON outbox_events
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

GRANT SELECT, INSERT, UPDATE, DELETE ON portal_versions TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_events TO guestportal_app;
