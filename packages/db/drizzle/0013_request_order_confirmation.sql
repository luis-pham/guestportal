CREATE TABLE IF NOT EXISTS request_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  guest_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  request_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  locale text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  confirmed_request_id uuid,
  confirm_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('draft', 'confirmed', 'expired', 'cancelled')),
  CHECK (request_type IN ('service', 'housekeeping', 'maintenance', 'amenity', 'other'))
);

CREATE INDEX IF NOT EXISTS request_drafts_guest_idx
  ON request_drafts(guest_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS request_drafts_conversation_idx
  ON request_drafts(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS request_drafts_expiry_idx
  ON request_drafts(expires_at)
  WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS request_drafts_confirm_key_uidx
  ON request_drafts(organization_id, property_id, confirm_idempotency_key)
  WHERE confirm_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS guest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  guest_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  request_draft_id uuid NOT NULL REFERENCES request_drafts(id),
  status text NOT NULL DEFAULT 'submitted',
  request_type text NOT NULL,
  title text NOT NULL,
  details text NOT NULL DEFAULT '',
  locale text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('submitted', 'cancelled')),
  CHECK (request_type IN ('service', 'housekeeping', 'maintenance', 'amenity', 'other'))
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_requests_draft_uidx
  ON guest_requests(request_draft_id);
CREATE UNIQUE INDEX IF NOT EXISTS guest_requests_confirm_key_uidx
  ON guest_requests(organization_id, property_id, idempotency_key);
CREATE INDEX IF NOT EXISTS guest_requests_guest_idx
  ON guest_requests(guest_session_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS guest_requests_property_status_idx
  ON guest_requests(organization_id, property_id, status, submitted_at DESC);

ALTER TABLE request_drafts
  ADD CONSTRAINT request_drafts_confirmed_request_fk
  FOREIGN KEY (confirmed_request_id) REFERENCES guest_requests(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  guest_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  items jsonb NOT NULL,
  locale text NOT NULL,
  notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  confirmed_order_id uuid,
  confirm_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('draft', 'confirmed', 'expired', 'cancelled')),
  CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0)
);

CREATE INDEX IF NOT EXISTS order_drafts_guest_idx
  ON order_drafts(guest_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_drafts_conversation_idx
  ON order_drafts(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_drafts_expiry_idx
  ON order_drafts(expires_at)
  WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS order_drafts_confirm_key_uidx
  ON order_drafts(organization_id, property_id, confirm_idempotency_key)
  WHERE confirm_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS guest_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  guest_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  order_draft_id uuid NOT NULL REFERENCES order_drafts(id),
  status text NOT NULL DEFAULT 'submitted',
  title text NOT NULL,
  items jsonb NOT NULL,
  locale text NOT NULL,
  notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('submitted', 'cancelled')),
  CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_orders_draft_uidx
  ON guest_orders(order_draft_id);
CREATE UNIQUE INDEX IF NOT EXISTS guest_orders_confirm_key_uidx
  ON guest_orders(organization_id, property_id, idempotency_key);
CREATE INDEX IF NOT EXISTS guest_orders_guest_idx
  ON guest_orders(guest_session_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS guest_orders_property_status_idx
  ON guest_orders(organization_id, property_id, status, submitted_at DESC);

ALTER TABLE order_drafts
  ADD CONSTRAINT order_drafts_confirmed_order_fk
  FOREIGN KEY (confirmed_order_id) REFERENCES guest_orders(id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE request_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_drafts_tenant_policy ON request_drafts;
CREATE POLICY request_drafts_tenant_policy ON request_drafts
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guest_requests_tenant_policy ON guest_requests;
CREATE POLICY guest_requests_tenant_policy ON guest_requests
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE order_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_drafts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_drafts_tenant_policy ON order_drafts;
CREATE POLICY order_drafts_tenant_policy ON order_drafts
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE guest_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guest_orders_tenant_policy ON guest_orders;
CREATE POLICY guest_orders_tenant_policy ON guest_orders
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON request_drafts TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON guest_requests TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_drafts TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON guest_orders TO guestportal_app;
