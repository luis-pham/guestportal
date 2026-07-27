ALTER TABLE guest_requests
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS in_progress_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE guest_requests
  DROP CONSTRAINT IF EXISTS guest_requests_status_check,
  ADD CONSTRAINT guest_requests_status_check
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'cancelled', 'in_progress', 'completed')),
  DROP CONSTRAINT IF EXISTS guest_requests_version_check,
  ADD CONSTRAINT guest_requests_version_check CHECK (version >= 1),
  DROP CONSTRAINT IF EXISTS guest_requests_completed_at_check,
  ADD CONSTRAINT guest_requests_completed_at_check
    CHECK (status <> 'completed' OR completed_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS guest_requests_assignee_queue_idx
  ON guest_requests(organization_id, property_id, assigned_staff_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS guest_requests_state_version_idx
  ON guest_requests(organization_id, property_id, id, status, version);

ALTER TABLE guest_orders
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS subtotal_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparing_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivering_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE guest_orders
  DROP CONSTRAINT IF EXISTS guest_orders_status_check,
  ADD CONSTRAINT guest_orders_status_check
    CHECK (status IN ('submitted', 'confirmed', 'cancelled', 'preparing', 'ready', 'delivering', 'completed')),
  DROP CONSTRAINT IF EXISTS guest_orders_version_check,
  ADD CONSTRAINT guest_orders_version_check CHECK (version >= 1),
  DROP CONSTRAINT IF EXISTS guest_orders_totals_check,
  ADD CONSTRAINT guest_orders_totals_check CHECK (subtotal_minor >= 0 AND total_minor >= subtotal_minor),
  DROP CONSTRAINT IF EXISTS guest_orders_completed_at_check,
  ADD CONSTRAINT guest_orders_completed_at_check
    CHECK (status <> 'completed' OR completed_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS guest_orders_assignee_queue_idx
  ON guest_orders(organization_id, property_id, assigned_staff_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS guest_orders_state_version_idx
  ON guest_orders(organization_id, property_id, id, status, version);

CREATE TABLE IF NOT EXISTS request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  request_id uuid NOT NULL REFERENCES guest_requests(id) ON DELETE CASCADE,
  previous_status text,
  next_status text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  reason text,
  idempotency_key text,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_status IN ('submitted', 'accepted', 'rejected', 'cancelled', 'in_progress', 'completed')),
  CHECK (previous_status IS NULL OR previous_status IN ('submitted', 'accepted', 'rejected', 'cancelled', 'in_progress', 'completed')),
  CHECK (actor_type IN ('guest', 'staff', 'system')),
  CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS request_status_history_request_idx
  ON request_status_history(request_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS request_status_history_idempotency_uidx
  ON request_status_history(organization_id, property_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  order_id uuid NOT NULL REFERENCES guest_orders(id) ON DELETE CASCADE,
  previous_status text,
  next_status text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  reason text,
  idempotency_key text,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_status IN ('submitted', 'confirmed', 'cancelled', 'preparing', 'ready', 'delivering', 'completed')),
  CHECK (previous_status IS NULL OR previous_status IN ('submitted', 'confirmed', 'cancelled', 'preparing', 'ready', 'delivering', 'completed')),
  CHECK (actor_type IN ('guest', 'staff', 'system')),
  CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history(order_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS order_status_history_idempotency_uidx
  ON order_status_history(organization_id, property_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_status_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS request_status_history_tenant_policy ON request_status_history;
CREATE POLICY request_status_history_tenant_policy ON request_status_history
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_status_history_tenant_policy ON order_status_history;
CREATE POLICY order_status_history_tenant_policy ON order_status_history
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON request_status_history TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_status_history TO guestportal_app;
