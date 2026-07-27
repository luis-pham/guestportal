import type { FastifyInstance } from 'fastify';
import type {
  GuestDraftConfirmRequest,
  GuestOrder,
  GuestOrderDraft,
  GuestOrderDraftCreateRequest,
  GuestOrderDraftCreateResponse,
  GuestOrderDraftConfirmResponse,
  GuestRequest,
  GuestRequestDraft,
  GuestRequestDraftCreateRequest,
  GuestRequestDraftCreateResponse,
  GuestRequestDraftConfirmResponse,
  OrderDraftItem,
} from '@guestportal/contracts';
import type { GuestSession, Sql, TransactionSql } from '@guestportal/db';
import { ApiError } from '../errors.js';

type ConversationLockRow = {
  id: string;
  status: string;
  retention_expires_at: Date | string;
  last_message_sequence: number;
};

type RequestDraftRow = {
  id: string;
  conversation_id: string;
  status: GuestRequestDraft['status'];
  request_type: GuestRequestDraft['requestType'];
  title: string;
  details: string;
  locale: string;
  metadata: Record<string, unknown>;
  expires_at: Date | string;
  confirmed_request_id: string | null;
  confirm_idempotency_key: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type GuestRequestRow = {
  id: string;
  conversation_id: string;
  request_draft_id: string;
  status: GuestRequest['status'];
  request_type: GuestRequest['requestType'];
  title: string;
  details: string;
  locale: string;
  metadata: Record<string, unknown>;
  submitted_at: Date | string;
};

type OrderDraftRow = {
  id: string;
  conversation_id: string;
  status: GuestOrderDraft['status'];
  title: string;
  items: OrderDraftItem[];
  locale: string;
  notes: string;
  metadata: Record<string, unknown>;
  expires_at: Date | string;
  confirmed_order_id: string | null;
  confirm_idempotency_key: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type GuestOrderRow = {
  id: string;
  conversation_id: string;
  order_draft_id: string;
  status: GuestOrder['status'];
  title: string;
  items: OrderDraftItem[];
  locale: string;
  notes: string;
  metadata: Record<string, unknown>;
  submitted_at: Date | string;
};

type QueryExecutor = Sql | TransactionSql;

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string) {
  return toDate(value).toISOString();
}

function toRequestDraft(row: RequestDraftRow): GuestRequestDraft {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    status: row.status,
    requestType: row.request_type,
    title: row.title,
    details: row.details,
    locale: row.locale,
    metadata: row.metadata,
    expiresAt: toIso(row.expires_at),
    confirmedRequestId: row.confirmed_request_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toGuestRequest(row: GuestRequestRow): GuestRequest {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    draftId: row.request_draft_id,
    status: row.status,
    requestType: row.request_type,
    title: row.title,
    details: row.details,
    locale: row.locale,
    metadata: row.metadata,
    submittedAt: toIso(row.submitted_at),
  };
}

function toOrderDraft(row: OrderDraftRow): GuestOrderDraft {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    status: row.status,
    title: row.title,
    items: row.items,
    locale: row.locale,
    notes: row.notes,
    metadata: row.metadata,
    expiresAt: toIso(row.expires_at),
    confirmedOrderId: row.confirmed_order_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toGuestOrder(row: GuestOrderRow): GuestOrder {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    draftId: row.order_draft_id,
    status: row.status,
    title: row.title,
    items: row.items,
    locale: row.locale,
    notes: row.notes,
    metadata: row.metadata,
    submittedAt: toIso(row.submitted_at),
  };
}

async function loadActiveConversation(
  app: FastifyInstance,
  session: GuestSession,
  conversationId: string,
) {
  const rows = await app.sql<ConversationLockRow[]>`
    SELECT id, status, retention_expires_at, last_message_sequence
    FROM conversations
    WHERE id = ${conversationId}::uuid
      AND organization_id = ${session.organizationId}::uuid
      AND property_id = ${session.propertyId}::uuid
      AND guest_session_id = ${session.id}::uuid
    LIMIT 1
  `;
  const conversation = rows[0];
  if (!conversation) {
    throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  if (conversation.status !== 'active') {
    throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting drafts.');
  }
  if (toDate(conversation.retention_expires_at).getTime() <= Date.now()) {
    throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
  }
  return conversation;
}

async function appendConfirmationMessage(
  tx: QueryExecutor,
  session: GuestSession,
  conversation: ConversationLockRow,
  input: {
    text: string;
    requestId?: string;
    orderId?: string;
  },
) {
  const nextSequence = conversation.last_message_sequence + 1;
  await tx`
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
      request_id,
      order_id
    )
    VALUES (
      ${session.organizationId}::uuid,
      ${session.propertyId}::uuid,
      ${session.id}::uuid,
      ${conversation.id}::uuid,
      ${nextSequence},
      'system',
      'system',
      ${session.locale},
      ${input.text},
      ${input.requestId ?? null}::uuid,
      ${input.orderId ?? null}::uuid
    )
  `;
  await tx`
    UPDATE conversations
    SET last_message_sequence = ${nextSequence},
        last_message_at = now(),
        updated_at = now()
    WHERE id = ${conversation.id}::uuid
  `;
}

export async function createRequestDraft(
  app: FastifyInstance,
  session: GuestSession,
  input: GuestRequestDraftCreateRequest,
): Promise<GuestRequestDraftCreateResponse> {
  await loadActiveConversation(app, session, input.conversationId);
  const locale = input.locale ?? session.locale;
  const rows = await app.sql<RequestDraftRow[]>`
    INSERT INTO request_drafts (
      organization_id,
      property_id,
      guest_session_id,
      conversation_id,
      request_type,
      title,
      details,
      locale,
      metadata,
      expires_at
    )
    VALUES (
      ${session.organizationId}::uuid,
      ${session.propertyId}::uuid,
      ${session.id}::uuid,
      ${input.conversationId}::uuid,
      ${input.requestType},
      ${input.title},
      ${input.details},
      ${locale},
      ${JSON.stringify(input.metadata)}::jsonb,
      now() + interval '15 minutes'
    )
    RETURNING *
  `;
  return { draft: toRequestDraft(rows[0]!) };
}

export async function createOrderDraft(
  app: FastifyInstance,
  session: GuestSession,
  input: GuestOrderDraftCreateRequest,
): Promise<GuestOrderDraftCreateResponse> {
  await loadActiveConversation(app, session, input.conversationId);
  const locale = input.locale ?? session.locale;
  const rows = await app.sql<OrderDraftRow[]>`
    INSERT INTO order_drafts (
      organization_id,
      property_id,
      guest_session_id,
      conversation_id,
      title,
      items,
      locale,
      notes,
      metadata,
      expires_at
    )
    VALUES (
      ${session.organizationId}::uuid,
      ${session.propertyId}::uuid,
      ${session.id}::uuid,
      ${input.conversationId}::uuid,
      ${input.title},
      ${JSON.stringify(input.items)}::jsonb,
      ${locale},
      ${input.notes},
      ${JSON.stringify(input.metadata)}::jsonb,
      now() + interval '15 minutes'
    )
    RETURNING *
  `;
  return { draft: toOrderDraft(rows[0]!) };
}

async function loadConfirmedRequest(tx: QueryExecutor, requestId: string) {
  const rows = await tx<GuestRequestRow[]>`
    SELECT *
    FROM guest_requests
    WHERE id = ${requestId}::uuid
    LIMIT 1
  `;
  return rows[0] ? toGuestRequest(rows[0]) : null;
}

async function loadConfirmedOrder(tx: QueryExecutor, orderId: string) {
  const rows = await tx<GuestOrderRow[]>`
    SELECT *
    FROM guest_orders
    WHERE id = ${orderId}::uuid
    LIMIT 1
  `;
  return rows[0] ? toGuestOrder(rows[0]) : null;
}

export async function confirmRequestDraft(
  app: FastifyInstance,
  session: GuestSession,
  draftId: string,
  input: GuestDraftConfirmRequest,
): Promise<GuestRequestDraftConfirmResponse> {
  return app.sql.begin(async (tx) => {
    const draftRows = await tx<RequestDraftRow[]>`
      SELECT *
      FROM request_drafts
      WHERE id = ${draftId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      FOR UPDATE
    `;
    const draft = draftRows[0];
    if (!draft) {
      throw new ApiError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
    }

    if (draft.status === 'confirmed' && draft.confirmed_request_id) {
      if (draft.confirm_idempotency_key !== input.idempotencyKey) {
        throw new ApiError(409, 'DRAFT_ALREADY_CONFIRMED', 'Draft has already been confirmed.');
      }
      const request = await loadConfirmedRequest(tx, draft.confirmed_request_id);
      if (!request) {
        throw new ApiError(500, 'REQUEST_CONFIRMATION_CORRUPT', 'Confirmed request is missing.');
      }
      return { request, idempotentReplay: true };
    }

    if (draft.status !== 'draft') {
      throw new ApiError(409, 'DRAFT_NOT_CONFIRMABLE', 'Draft cannot be confirmed.');
    }
    if (toDate(draft.expires_at).getTime() <= Date.now()) {
      await tx`
        UPDATE request_drafts
        SET status = 'expired', updated_at = now()
        WHERE id = ${draft.id}::uuid
      `;
      throw new ApiError(410, 'DRAFT_EXPIRED', 'Draft has expired.');
    }

    const existingKeyRows = await tx<GuestRequestRow[]>`
      SELECT *
      FROM guest_requests
      WHERE organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (existingKeyRows[0]) {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used for another draft.');
    }

    const conversationRows = await tx<ConversationLockRow[]>`
      SELECT id, status, retention_expires_at, last_message_sequence
      FROM conversations
      WHERE id = ${draft.conversation_id}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      FOR UPDATE
    `;
    const conversation = conversationRows[0];
    if (!conversation || conversation.status !== 'active') {
      throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting confirmations.');
    }
    if (toDate(conversation.retention_expires_at).getTime() <= Date.now()) {
      throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
    }

    const requestRows = await tx<GuestRequestRow[]>`
      INSERT INTO guest_requests (
        organization_id,
        property_id,
        guest_session_id,
        conversation_id,
        request_draft_id,
        request_type,
        title,
        details,
        locale,
        metadata,
        idempotency_key
      )
      VALUES (
        ${session.organizationId}::uuid,
        ${session.propertyId}::uuid,
        ${session.id}::uuid,
        ${draft.conversation_id}::uuid,
        ${draft.id}::uuid,
        ${draft.request_type},
        ${draft.title},
        ${draft.details},
        ${draft.locale},
        ${JSON.stringify(draft.metadata)}::jsonb,
        ${input.idempotencyKey}
      )
      RETURNING *
    `;
    const request = toGuestRequest(requestRows[0]!);

    await tx`
      UPDATE request_drafts
      SET status = 'confirmed',
          confirmed_request_id = ${request.id}::uuid,
          confirm_idempotency_key = ${input.idempotencyKey},
          updated_at = now()
      WHERE id = ${draft.id}::uuid
    `;
    await tx`
      INSERT INTO outbox_events (
        organization_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key
      )
      VALUES (
        ${session.organizationId}::uuid,
        'request',
        ${request.id},
        'request.submitted.v1',
        ${JSON.stringify({
          propertyId: session.propertyId,
          guestSessionId: session.id,
          conversationId: request.conversationId,
          draftId: draft.id,
        })}::jsonb,
        ${`request.confirm:${draft.id}:${input.idempotencyKey}`}
      )
    `;
    await appendConfirmationMessage(tx, session, conversation, {
      text: `Request confirmed: ${request.title}`,
      requestId: request.id,
    });
    return { request, idempotentReplay: false };
  }) as Promise<GuestRequestDraftConfirmResponse>;
}

export async function confirmOrderDraft(
  app: FastifyInstance,
  session: GuestSession,
  draftId: string,
  input: GuestDraftConfirmRequest,
): Promise<GuestOrderDraftConfirmResponse> {
  return app.sql.begin(async (tx) => {
    const draftRows = await tx<OrderDraftRow[]>`
      SELECT *
      FROM order_drafts
      WHERE id = ${draftId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      FOR UPDATE
    `;
    const draft = draftRows[0];
    if (!draft) {
      throw new ApiError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
    }

    if (draft.status === 'confirmed' && draft.confirmed_order_id) {
      if (draft.confirm_idempotency_key !== input.idempotencyKey) {
        throw new ApiError(409, 'DRAFT_ALREADY_CONFIRMED', 'Draft has already been confirmed.');
      }
      const order = await loadConfirmedOrder(tx, draft.confirmed_order_id);
      if (!order) {
        throw new ApiError(500, 'ORDER_CONFIRMATION_CORRUPT', 'Confirmed order is missing.');
      }
      return { order, idempotentReplay: true };
    }

    if (draft.status !== 'draft') {
      throw new ApiError(409, 'DRAFT_NOT_CONFIRMABLE', 'Draft cannot be confirmed.');
    }
    if (toDate(draft.expires_at).getTime() <= Date.now()) {
      await tx`
        UPDATE order_drafts
        SET status = 'expired', updated_at = now()
        WHERE id = ${draft.id}::uuid
      `;
      throw new ApiError(410, 'DRAFT_EXPIRED', 'Draft has expired.');
    }

    const existingKeyRows = await tx<GuestOrderRow[]>`
      SELECT *
      FROM guest_orders
      WHERE organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (existingKeyRows[0]) {
      throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used for another draft.');
    }

    const conversationRows = await tx<ConversationLockRow[]>`
      SELECT id, status, retention_expires_at, last_message_sequence
      FROM conversations
      WHERE id = ${draft.conversation_id}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      FOR UPDATE
    `;
    const conversation = conversationRows[0];
    if (!conversation || conversation.status !== 'active') {
      throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting confirmations.');
    }
    if (toDate(conversation.retention_expires_at).getTime() <= Date.now()) {
      throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
    }

    const orderRows = await tx<GuestOrderRow[]>`
      INSERT INTO guest_orders (
        organization_id,
        property_id,
        guest_session_id,
        conversation_id,
        order_draft_id,
        title,
        items,
        locale,
        notes,
        metadata,
        idempotency_key
      )
      VALUES (
        ${session.organizationId}::uuid,
        ${session.propertyId}::uuid,
        ${session.id}::uuid,
        ${draft.conversation_id}::uuid,
        ${draft.id}::uuid,
        ${draft.title},
        ${JSON.stringify(draft.items)}::jsonb,
        ${draft.locale},
        ${draft.notes},
        ${JSON.stringify(draft.metadata)}::jsonb,
        ${input.idempotencyKey}
      )
      RETURNING *
    `;
    const order = toGuestOrder(orderRows[0]!);

    await tx`
      UPDATE order_drafts
      SET status = 'confirmed',
          confirmed_order_id = ${order.id}::uuid,
          confirm_idempotency_key = ${input.idempotencyKey},
          updated_at = now()
      WHERE id = ${draft.id}::uuid
    `;
    await tx`
      INSERT INTO outbox_events (
        organization_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key
      )
      VALUES (
        ${session.organizationId}::uuid,
        'order',
        ${order.id},
        'order.submitted.v1',
        ${JSON.stringify({
          propertyId: session.propertyId,
          guestSessionId: session.id,
          conversationId: order.conversationId,
          draftId: draft.id,
        })}::jsonb,
        ${`order.confirm:${draft.id}:${input.idempotencyKey}`}
      )
    `;
    await appendConfirmationMessage(tx, session, conversation, {
      text: `Order confirmed: ${order.title}`,
      orderId: order.id,
    });
    return { order, idempotentReplay: false };
  }) as Promise<GuestOrderDraftConfirmResponse>;
}
