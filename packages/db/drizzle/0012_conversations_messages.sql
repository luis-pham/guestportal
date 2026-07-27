CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  guest_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  locale text NOT NULL,
  retention_policy text NOT NULL,
  retention_expires_at timestamptz NOT NULL,
  last_message_sequence integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  handed_off_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('active', 'handed_off', 'closed', 'expired')),
  CHECK (retention_policy IN ('standard_30_days', 'extended_90_days')),
  CHECK (last_message_sequence >= 0)
);

CREATE INDEX IF NOT EXISTS conversations_guest_session_idx
  ON conversations(guest_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_property_status_idx
  ON conversations(organization_id, property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_retention_expires_idx
  ON conversations(retention_expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  guest_session_id uuid NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  role text NOT NULL,
  source text NOT NULL,
  original_language text,
  original_text text NOT NULL,
  translated_text text,
  tool_name text,
  tool_payload jsonb,
  request_id uuid,
  order_id uuid,
  client_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sequence > 0),
  CHECK (role IN ('guest', 'assistant', 'staff', 'system', 'tool')),
  CHECK (source IN ('guest_web', 'assistant', 'staff_web', 'system', 'tool_gateway'))
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_sequence_uidx
  ON messages(conversation_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_client_message_uidx
  ON messages(conversation_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_conversation_order_idx
  ON messages(conversation_id, sequence ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_property_created_idx
  ON messages(organization_id, property_id, created_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_tenant_policy ON conversations;
CREATE POLICY conversations_tenant_policy ON conversations
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_tenant_policy ON messages;
CREATE POLICY messages_tenant_policy ON messages
  USING (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.organization_id', true), '') = ''
    OR organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO guestportal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO guestportal_app;
