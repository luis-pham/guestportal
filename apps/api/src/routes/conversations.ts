import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import {
  conversationCreateRequestSchema,
  guestAiToolExecuteRequestSchema,
  guestMessageCreateRequestSchema,
  portalConfigDocumentSchema,
  type CatalogToolItem,
  type ConversationMessage,
  type ConversationSummary,
  type PortalConfigDocument,
  type TranscriptRetentionPolicy,
} from '@guestportal/contracts';
import { AiToolError, createAiToolGateway, createGuestAiToolDefinitions } from '@guestportal/ai-tools';
import { locations, portalVersions, properties, type GuestSession } from '@guestportal/db';
import { ApiError } from '../errors.js';
import {
  GUEST_SESSION_COOKIE,
  resolveGuestSession,
} from '../services/guest-sessions.js';
import { z } from 'zod';
import { hybridSearchKnowledge } from '../knowledge-search.js';
import { createOrderDraft, createRequestDraft } from '../services/request-orders.js';

const RETENTION_POLICY_DAYS: Record<TranscriptRetentionPolicy, number> = {
  standard_30_days: 30,
  extended_90_days: 90,
};

type ConversationRow = {
  id: string;
  organization_id: string;
  property_id: string;
  guest_session_id: string;
  status: ConversationSummary['status'];
  locale: string;
  retention_policy: TranscriptRetentionPolicy;
  retention_expires_at: Date | string;
  last_message_sequence: number;
  handed_off_at: Date | string | null;
  closed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sequence: number;
  role: ConversationMessage['role'];
  source: ConversationMessage['source'];
  original_language: string | null;
  original_text: string;
  translated_text: string | null;
  tool_name: string | null;
  tool_payload: Record<string, unknown> | null;
  request_id: string | null;
  order_id: string | null;
  client_message_id: string | null;
  created_at: Date | string;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string | null) {
  return value ? toDate(value).toISOString() : null;
}

function toConversation(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    status: row.status,
    locale: row.locale,
    retentionPolicy: row.retention_policy,
    retentionExpiresAt: toIso(row.retention_expires_at)!,
    lastMessageSequence: row.last_message_sequence,
    handedOffAt: toIso(row.handed_off_at),
    closedAt: toIso(row.closed_at),
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sequence: row.sequence,
    role: row.role,
    source: row.source,
    originalLanguage: row.original_language,
    originalText: row.original_text,
    translatedText: row.translated_text,
    toolName: row.tool_name,
    toolPayload: row.tool_payload,
    requestId: row.request_id,
    orderId: row.order_id,
    clientMessageId: row.client_message_id,
    createdAt: toIso(row.created_at)!,
  };
}

function isRetentionExpired(row: ConversationRow, now = new Date()) {
  return toDate(row.retention_expires_at).getTime() <= now.getTime() || row.status === 'expired';
}

function normalizeLocale(requested: 'vi' | 'en' | 'auto' | undefined, fallback: string) {
  return requested && requested !== 'auto' ? requested : fallback;
}

function text(value: { vi: string; en: string } | undefined | null) {
  return value ?? { vi: '', en: '' };
}

const handoffRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
});

function fromPublishedPortal(config: PortalConfigDocument): CatalogToolItem[] {
  const items: CatalogToolItem[] = [];
  for (const section of config.sections) {
    if (!section.enabled) continue;
    if (section.type === 'quick_actions') {
      for (const action of section.actions) {
        items.push({
          id: action.id,
          type: 'action',
          label: action.label,
          body: null,
          href: action.href,
          metadata: { icon: action.icon },
        });
      }
    }
    if (section.type === 'featured_services') {
      for (const serviceId of section.serviceIds) {
        items.push({
          id: serviceId,
          type: 'service',
          label: { vi: serviceId, en: serviceId },
          body: null,
          href: null,
          metadata: { serviceId },
        });
      }
    }
    if (section.type === 'schedule') {
      for (const item of section.items) {
        items.push({
          id: item.id,
          type: 'schedule',
          label: item.label,
          body: item.timeLabel,
          href: null,
          metadata: {},
        });
      }
    }
    if (section.type === 'guide_links') {
      for (const link of section.links) {
        items.push({
          id: link.id,
          type: 'guide',
          label: link.label,
          body: null,
          href: link.href,
          metadata: {},
        });
      }
    }
    if (section.type === 'promotion_banner') {
      items.push({
        id: section.id,
        type: 'promotion',
        label: section.title,
        body: section.body,
        href: section.href ?? null,
        metadata: {},
      });
    }
    if (section.type === 'contact_help') {
      items.push({
        id: section.id,
        type: 'contact',
        label: section.title,
        body: text(section.body),
        href: null,
        metadata: {
          phone: section.phone ?? null,
          email: section.email ?? null,
        },
      });
    }
  }
  return items;
}

async function loadPublishedPortalConfig(
  app: FastifyInstance,
  organizationId: string,
  propertyId: string,
) {
  const rows = await app.db
    .select()
    .from(portalVersions)
    .where(
      and(
        eq(portalVersions.organizationId, organizationId),
        eq(portalVersions.propertyId, propertyId),
      ),
    )
    .orderBy(desc(portalVersions.versionNumber))
    .limit(1);
  const version = rows[0];
  if (!version) return null;
  return portalConfigDocumentSchema.parse(version.config);
}

function toApiError(error: AiToolError) {
  return new ApiError(error.statusCode, error.code, error.message, error.details);
}

async function requireGuestSession(app: FastifyInstance, request: FastifyRequest) {
  const cookieToken = request.cookies[GUEST_SESSION_COOKIE];
  if (!cookieToken) {
    throw new ApiError(401, 'GUEST_SESSION_REQUIRED', 'Guest session required.');
  }

  const session = await resolveGuestSession(app.db, cookieToken);
  if (!session) {
    throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
  }

  const rows = await app.db
    .select({ property: properties, location: locations })
    .from(properties)
    .innerJoin(locations, eq(locations.id, session.locationId))
    .where(
      and(
        eq(properties.id, session.propertyId),
        eq(properties.organizationId, session.organizationId),
        eq(properties.status, 'active'),
        eq(locations.propertyId, session.propertyId),
        eq(locations.organizationId, session.organizationId),
        eq(locations.status, 'active'),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
  }

  return { session };
}

async function loadScopedConversation(
  app: FastifyInstance,
  conversationId: string,
  session: GuestSession,
) {
  const rows = await app.sql<ConversationRow[]>`
    SELECT *
    FROM conversations
    WHERE id = ${conversationId}::uuid
      AND organization_id = ${session.organizationId}::uuid
      AND property_id = ${session.propertyId}::uuid
      AND guest_session_id = ${session.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  if (isRetentionExpired(row)) {
    await app.sql`
      UPDATE conversations
      SET status = 'expired', updated_at = now()
      WHERE id = ${row.id}::uuid AND status <> 'expired'
    `;
    throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
  }
  return row;
}

export async function registerConversationRoutes(app: FastifyInstance) {
  app.post('/v1/guest/conversations', async (request) => {
    const { session } = await requireGuestSession(app, request);
    const body = conversationCreateRequestSchema.parse(request.body ?? {});
    const retentionDays = RETENTION_POLICY_DAYS[body.retentionPolicy];

    const rows = await app.sql<ConversationRow[]>`
      INSERT INTO conversations (
        organization_id,
        property_id,
        guest_session_id,
        status,
        locale,
        retention_policy,
        retention_expires_at
      )
      VALUES (
        ${session.organizationId}::uuid,
        ${session.propertyId}::uuid,
        ${session.id}::uuid,
        'active',
        ${body.locale ?? session.locale},
        ${body.retentionPolicy},
        now() + (${retentionDays} * interval '1 day')
      )
      RETURNING *
    `;

    const row = rows[0];
    if (!row) {
      throw new ApiError(500, 'CONVERSATION_CREATE_FAILED', 'Could not create conversation.');
    }

    return { conversation: toConversation(row) };
  });

  app.get('/v1/guest/conversations/:conversationId', async (request) => {
    const { session } = await requireGuestSession(app, request);
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const conversation = await loadScopedConversation(app, params.conversationId, session);

    const messageRows = await app.sql<MessageRow[]>`
      SELECT
        id,
        conversation_id,
        sequence,
        role,
        source,
        original_language,
        original_text,
        translated_text,
        tool_name,
        tool_payload,
        request_id,
        order_id,
        client_message_id,
        created_at
      FROM messages
      WHERE conversation_id = ${conversation.id}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      ORDER BY sequence ASC, created_at ASC, id ASC
    `;

    return {
      conversation: toConversation(conversation),
      messages: messageRows.map(toMessage),
    };
  });

  app.post('/v1/guest/conversations/:conversationId/handoff', async (request) => {
    const { session } = await requireGuestSession(app, request);
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = handoffRequestSchema.parse(request.body ?? {});

    const result = await app.sql.begin(async (tx) => {
      const conversations = await tx<ConversationRow[]>`
        SELECT *
        FROM conversations
        WHERE id = ${params.conversationId}::uuid
          AND organization_id = ${session.organizationId}::uuid
          AND property_id = ${session.propertyId}::uuid
          AND guest_session_id = ${session.id}::uuid
        FOR UPDATE
      `;
      const conversation = conversations[0];
      if (!conversation) {
        throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }
      if (isRetentionExpired(conversation)) {
        await tx`
          UPDATE conversations
          SET status = 'expired', updated_at = now()
          WHERE id = ${conversation.id}::uuid AND status <> 'expired'
        `;
        throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
      }
      if (conversation.status === 'handed_off') {
        return {
          conversation,
          message: null,
          alreadyRequested: true,
        };
      }
      if (conversation.status !== 'active') {
        throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting handoff.');
      }

      const note = body.reason ? ` Guest note: ${body.reason}` : '';
      const originalText = `Human handoff requested. Staff can review this conversation when available.${note}`;
      const nextSequence = conversation.last_message_sequence + 1;
      const inserted = await tx<MessageRow[]>`
        INSERT INTO messages (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          sequence,
          role,
          source,
          original_language,
          original_text
        )
        VALUES (
          ${session.organizationId}::uuid,
          ${session.propertyId}::uuid,
          ${session.id}::uuid,
          ${conversation.id}::uuid,
          ${nextSequence},
          'system',
          'system',
          ${conversation.locale},
          ${originalText}
        )
        RETURNING
          id,
          conversation_id,
          sequence,
          role,
          source,
          original_language,
          original_text,
          translated_text,
          tool_name,
          tool_payload,
          request_id,
          order_id,
          client_message_id,
          created_at
      `;
      const updated = await tx<ConversationRow[]>`
        UPDATE conversations
        SET
          status = 'handed_off',
          handed_off_at = now(),
          last_message_sequence = ${nextSequence},
          last_message_at = now(),
          updated_at = now()
        WHERE id = ${conversation.id}::uuid
        RETURNING *
      `;
      const message = inserted[0];
      const row = updated[0];
      if (!message || !row) {
        throw new ApiError(500, 'HANDOFF_CREATE_FAILED', 'Could not request handoff.');
      }
      return {
        conversation: row,
        message,
        alreadyRequested: false,
      };
    });

    return {
      conversation: toConversation(result.conversation),
      handoff: {
        state: 'requested',
        alreadyRequested: result.alreadyRequested,
        message: result.message ? toMessage(result.message) : null,
      },
    };
  });

  app.post('/v1/guest/conversations/:conversationId/messages', async (request) => {
    const { session } = await requireGuestSession(app, request);
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = guestMessageCreateRequestSchema.parse(request.body);

    const message = await app.sql.begin(async (tx) => {
      const conversations = await tx<ConversationRow[]>`
        SELECT *
        FROM conversations
        WHERE id = ${params.conversationId}::uuid
          AND organization_id = ${session.organizationId}::uuid
          AND property_id = ${session.propertyId}::uuid
          AND guest_session_id = ${session.id}::uuid
        FOR UPDATE
      `;
      const conversation = conversations[0];
      if (!conversation) {
        throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }
      if (isRetentionExpired(conversation)) {
        await tx`
          UPDATE conversations
          SET status = 'expired', updated_at = now()
          WHERE id = ${conversation.id}::uuid AND status <> 'expired'
        `;
        throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
      }
      if (conversation.status !== 'active') {
        throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting messages.');
      }

      if (body.clientMessageId) {
        const existing = await tx<MessageRow[]>`
          SELECT
            id,
            conversation_id,
            sequence,
            role,
            source,
            original_language,
            original_text,
            translated_text,
            tool_name,
            tool_payload,
            request_id,
            order_id,
            client_message_id,
            created_at
          FROM messages
          WHERE conversation_id = ${conversation.id}::uuid
            AND client_message_id = ${body.clientMessageId}
          LIMIT 1
        `;
        if (existing[0]) {
          return existing[0];
        }
      }

      const nextSequence = conversation.last_message_sequence + 1;
      const inserted = await tx<MessageRow[]>`
        INSERT INTO messages (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          sequence,
          role,
          source,
          original_language,
          original_text,
          translated_text,
          client_message_id
        )
        VALUES (
          ${session.organizationId}::uuid,
          ${session.propertyId}::uuid,
          ${session.id}::uuid,
          ${conversation.id}::uuid,
          ${nextSequence},
          'guest',
          'guest_web',
          ${body.originalLanguage ?? null},
          ${body.text},
          ${body.translatedText ?? null},
          ${body.clientMessageId ?? null}
        )
        RETURNING
          id,
          conversation_id,
          sequence,
          role,
          source,
          original_language,
          original_text,
          translated_text,
          tool_name,
          tool_payload,
          request_id,
          order_id,
          client_message_id,
          created_at
      `;

      await tx`
        UPDATE conversations
        SET last_message_sequence = ${nextSequence}, last_message_at = now(), updated_at = now()
        WHERE id = ${conversation.id}::uuid
      `;

      const row = inserted[0];
      if (!row) {
        throw new ApiError(500, 'MESSAGE_CREATE_FAILED', 'Could not persist message.');
      }
      return row;
    });

    return { message: toMessage(message) };
  });

  app.post('/v1/guest/conversations/:conversationId/tool-results', async (request) => {
    const { session } = await requireGuestSession(app, request);
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const conversation = await loadScopedConversation(app, params.conversationId, session);
    if (conversation.status !== 'active') {
      throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting tool calls.');
    }

    const body = guestAiToolExecuteRequestSchema.parse(request.body);
    const scope = {
      organizationId: session.organizationId,
      propertyId: session.propertyId,
      guestSessionId: session.id,
      conversationId: conversation.id,
      locale: conversation.locale,
    };
    const gateway = createAiToolGateway(
      createGuestAiToolDefinitions({
        searchKnowledge: async (input, toolScope) =>
          hybridSearchKnowledge({
            sql: app.sql,
            organizationId: toolScope.organizationId,
            propertyId: toolScope.propertyId,
            query: input.query,
            limit: input.limit,
          }),
        readCatalog: async (input, toolScope) => {
          const locale = normalizeLocale(input.locale, toolScope.locale);
          const config = await loadPublishedPortalConfig(
            app,
            toolScope.organizationId,
            toolScope.propertyId,
          );
          const items = config ? fromPublishedPortal(config).slice(0, input.limit) : [];
          return {
            propertyId: toolScope.propertyId,
            locale,
            items,
            noResult: items.length === 0,
          };
        },
        readServices: async (input, toolScope) => {
          const locale = normalizeLocale(input.locale, toolScope.locale);
          const config = await loadPublishedPortalConfig(
            app,
            toolScope.organizationId,
            toolScope.propertyId,
          );
          const services = config
            ? fromPublishedPortal(config)
                .filter((item) => item.type === 'service')
                .slice(0, input.limit)
            : [];
          return {
            propertyId: toolScope.propertyId,
            locale,
            services,
            noResult: services.length === 0,
          };
        },
        draftRequest: async (input) =>
          createRequestDraft(app, session, {
            ...input,
            conversationId: conversation.id,
          }),
        draftOrder: async (input) =>
          createOrderDraft(app, session, {
            ...input,
            conversationId: conversation.id,
          }),
      }),
    );

    let result: Record<string, unknown>;
    try {
      result = (await gateway.execute({
        toolName: body.toolName,
        input: body.input,
        scope,
      })) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AiToolError) {
        throw toApiError(error);
      }
      throw error;
    }

    await app.sql.begin(async (tx) => {
      const conversations = await tx<ConversationRow[]>`
        SELECT *
        FROM conversations
        WHERE id = ${conversation.id}::uuid
          AND organization_id = ${session.organizationId}::uuid
          AND property_id = ${session.propertyId}::uuid
          AND guest_session_id = ${session.id}::uuid
        FOR UPDATE
      `;
      const locked = conversations[0];
      if (!locked) {
        throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }
      if (isRetentionExpired(locked)) {
        await tx`
          UPDATE conversations
          SET status = 'expired', updated_at = now()
          WHERE id = ${locked.id}::uuid AND status <> 'expired'
        `;
        throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
      }

      const nextSequence = locked.last_message_sequence + 1;
      await tx`
        INSERT INTO messages (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          sequence,
          role,
          source,
          original_text,
          tool_name,
          tool_payload
        )
        VALUES (
          ${session.organizationId}::uuid,
          ${session.propertyId}::uuid,
          ${session.id}::uuid,
          ${locked.id}::uuid,
          ${nextSequence},
          'tool',
          'tool_gateway',
          ${`Tool result: ${body.toolName}`},
          ${body.toolName},
          ${JSON.stringify(result)}::jsonb
        )
      `;
      await tx`
        UPDATE conversations
        SET last_message_sequence = ${nextSequence}, last_message_at = now(), updated_at = now()
        WHERE id = ${locked.id}::uuid
      `;
    });

    return {
      toolName: body.toolName,
      result,
    };
  });
}
