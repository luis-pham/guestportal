CREATE INDEX IF NOT EXISTS outbox_events_org_property_created_idx
  ON outbox_events (
    organization_id,
    ((payload->>'propertyId')),
    created_at DESC,
    ((id::text)) DESC
  );
