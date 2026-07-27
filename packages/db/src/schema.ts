import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('active'),
  defaultLocale: text('default_locale').notNull().default('vi'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    type: text('type').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    defaultLocale: text('default_locale').notNull(),
    supportedLocales: text('supported_locales').array().notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('properties_org_slug_uidx').on(table.organizationId, table.slug),
    index('properties_org_idx').on(table.organizationId),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    locale: text('locale').notNull().default('vi'),
    status: text('status').notNull().default('active'),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_uidx').on(table.email)],
);

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('memberships_org_user_uidx').on(table.organizationId, table.userId),
    index('memberships_user_idx').on(table.userId),
  ],
);

export const propertyAssignments = pgTable(
  'property_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('property_assignments_uidx').on(table.propertyId, table.userId),
    index('property_assignments_user_idx').on(table.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_uidx').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_org_idx').on(table.organizationId),
    index('audit_logs_actor_idx').on(table.actorUserId),
  ],
);

export type PropertyBrandingConfig = {
  displayName: string;
  primaryColor: string;
  primaryHoverColor: string;
  accentColor: string | null;
  backgroundColor: string;
  textColor: string;
  logoAssetId: string | null;
  coverAssetId: string | null;
  fontFamily: 'system' | 'serif' | 'sans' | 'display';
};

export const propertyBranding = pgTable(
  'property_branding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    config: jsonb('config').$type<PropertyBrandingConfig>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('property_branding_property_uidx').on(table.propertyId),
    index('property_branding_org_idx').on(table.organizationId),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id').references(() => properties.id),
    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: text('checksum_sha256'),
    visibility: text('visibility').notNull().default('public'),
    status: text('status').notNull().default('pending'),
    purpose: text('purpose').notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('assets_bucket_object_key_uidx').on(table.bucket, table.objectKey),
    index('assets_org_idx').on(table.organizationId),
    index('assets_property_idx').on(table.propertyId),
    index('assets_status_idx').on(table.status),
  ],
);

export const schemaVersion = pgTable('schema_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type User = typeof users.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type PropertyAssignment = typeof propertyAssignments.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PropertyBrandingRow = typeof propertyBranding.$inferSelect;
export type Asset = typeof assets.$inferSelect;

/** Opaque JSON document validated by @guestportal/contracts portal schemas. */
export type PortalConfigJson = Record<string, unknown>;

export const portalTemplates = pgTable(
  'portal_templates',
  {
    id: text('id').primaryKey(),
    propertyType: text('property_type').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').$type<PortalConfigJson>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('portal_templates_property_type_idx').on(table.propertyType)],
);

export const portalDrafts = pgTable(
  'portal_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    version: integer('version').notNull().default(1),
    config: jsonb('config').$type<PortalConfigJson>().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('portal_drafts_property_uidx').on(table.propertyId),
    index('portal_drafts_org_idx').on(table.organizationId),
  ],
);

export type PortalTemplate = typeof portalTemplates.$inferSelect;
export type PortalDraft = typeof portalDrafts.$inferSelect;

export const portalVersions = pgTable(
  'portal_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    versionNumber: integer('version_number').notNull(),
    config: jsonb('config').$type<PortalConfigJson>().notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    publishedBy: uuid('published_by').references(() => users.id),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    restoredFromVersionId: uuid('restored_from_version_id'),
    note: text('note'),
  },
  (table) => [
    uniqueIndex('portal_versions_property_number_uidx').on(table.propertyId, table.versionNumber),
    index('portal_versions_property_idx').on(table.propertyId),
    index('portal_versions_org_idx').on(table.organizationId),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('outbox_events_idempotency_uidx').on(table.idempotencyKey)],
);

export type PortalVersion = typeof portalVersions.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;

export type LocationName = {
  vi: string;
  en: string;
};

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    parentId: uuid('parent_id'),
    type: text('type').notNull().default('area'),
    code: text('code').notNull(),
    name: jsonb('name').$type<LocationName>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('locations_property_code_uidx').on(table.propertyId, table.code),
    index('locations_org_idx').on(table.organizationId),
    index('locations_property_idx').on(table.propertyId),
  ],
);

export const qrCodes = pgTable(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    publicToken: text('public_token').notNull(),
    publicTokenHash: text('public_token_hash').notNull(),
    destinationType: text('destination_type').notNull().default('portal_home'),
    destinationId: uuid('destination_id'),
    enabled: boolean('enabled').notNull().default(true),
    scanCount: bigint('scan_count', { mode: 'number' }).notNull().default(0),
    lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('qr_codes_public_token_uidx').on(table.publicToken),
    uniqueIndex('qr_codes_public_token_hash_uidx').on(table.publicTokenHash),
    index('qr_codes_org_idx').on(table.organizationId),
    index('qr_codes_property_idx').on(table.propertyId),
    index('qr_codes_location_idx').on(table.locationId),
  ],
);

export type Location = typeof locations.$inferSelect;
export type QrCode = typeof qrCodes.$inferSelect;

export const guestSessions = pgTable(
  'guest_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    qrCodeId: uuid('qr_code_id').references(() => qrCodes.id),
    tokenHash: text('token_hash').notNull(),
    locale: text('locale').notNull().default('en'),
    status: text('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('guest_sessions_token_hash_uidx').on(table.tokenHash),
    index('guest_sessions_org_idx').on(table.organizationId),
    index('guest_sessions_property_idx').on(table.propertyId),
    index('guest_sessions_expires_idx').on(table.expiresAt),
  ],
);

export type GuestSession = typeof guestSessions.$inferSelect;

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    guestSessionId: uuid('guest_session_id')
      .notNull()
      .references(() => guestSessions.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'),
    locale: text('locale').notNull(),
    retentionPolicy: text('retention_policy').notNull(),
    retentionExpiresAt: timestamp('retention_expires_at', { withTimezone: true }).notNull(),
    lastMessageSequence: integer('last_message_sequence').notNull().default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    handedOffAt: timestamp('handed_off_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('conversations_guest_session_idx').on(table.guestSessionId, table.createdAt),
    index('conversations_property_status_idx').on(
      table.organizationId,
      table.propertyId,
      table.status,
      table.createdAt,
    ),
    index('conversations_retention_expires_idx').on(table.retentionExpiresAt),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    guestSessionId: uuid('guest_session_id')
      .notNull()
      .references(() => guestSessions.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    role: text('role').notNull(),
    source: text('source').notNull(),
    originalLanguage: text('original_language'),
    originalText: text('original_text').notNull(),
    translatedText: text('translated_text'),
    toolName: text('tool_name'),
    toolPayload: jsonb('tool_payload').$type<Record<string, unknown>>(),
    requestId: uuid('request_id'),
    orderId: uuid('order_id'),
    clientMessageId: text('client_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('messages_conversation_sequence_uidx').on(table.conversationId, table.sequence),
    uniqueIndex('messages_conversation_client_message_uidx').on(
      table.conversationId,
      table.clientMessageId,
    ),
    index('messages_conversation_order_idx').on(
      table.conversationId,
      table.sequence,
      table.createdAt,
    ),
    index('messages_property_created_idx').on(
      table.organizationId,
      table.propertyId,
      table.createdAt,
    ),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;

export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    sourceLanguage: text('source_language'),
    assetId: uuid('asset_id').references(() => assets.id),
    r2ObjectKey: text('r2_object_key'),
    checksumSha256: text('checksum_sha256'),
    version: integer('version').notNull().default(1),
    status: text('status').notNull().default('draft'),
    parserVersion: text('parser_version'),
    embeddingModel: text('embedding_model'),
    embeddingModelVersion: text('embedding_model_version'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('knowledge_sources_property_status_idx').on(
      table.organizationId,
      table.propertyId,
      table.status,
      table.createdAt,
    ),
    index('knowledge_sources_asset_idx').on(table.assetId),
  ],
);

export type KnowledgeSource = typeof knowledgeSources.$inferSelect;

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSources.id),
    ordinal: integer('ordinal').notNull(),
    content: text('content').notNull(),
    headingPath: jsonb('heading_path').$type<string[]>().notNull().default([]),
    sourceLanguage: text('source_language').notNull(),
    contentHash: text('content_hash').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    active: boolean('active').notNull().default(true),
    version: integer('version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('knowledge_chunks_source_version_ordinal_uidx').on(
      table.sourceId,
      table.version,
      table.ordinal,
    ),
    index('knowledge_chunks_active_lookup_idx').on(
      table.organizationId,
      table.propertyId,
      table.sourceId,
      table.active,
      table.version,
    ),
  ],
);

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
