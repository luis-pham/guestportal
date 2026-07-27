import type { FastifyInstance } from 'fastify';
import type {
  GuestDraftConfirmRequest,
  GuestCancelRequest,
  GuestOrder,
  GuestOrderDraft,
  GuestOrderDraftCreateRequest,
  GuestOrderDraftCreateResponse,
  GuestOrderDraftConfirmResponse,
  GuestOrderStatus,
  GuestRequest,
  GuestRequestDraft,
  GuestRequestDraftCreateRequest,
  GuestRequestDraftCreateResponse,
  GuestRequestDraftConfirmResponse,
  GuestRequestStatus,
  GuestWorkItem,
  OrderDraftItem,
  StaffTransitionRequest,
} from '@guestportal/contracts';
import type { GuestSession, Sql, TransactionSql } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { assertOrderTransition, assertRequestTransition } from './request-order-state.js';

export type StaffWorkQueue = 'inbox' | 'my_work' | 'history' | 'all';

export type StaffWorkItemSummary = {
  kind: 'request' | 'order';
  id: string;
  status: GuestRequestStatus | GuestOrderStatus;
  version: number;
  title: string;
  summary: string;
  locale: string;
  conversationId: string;
  location: {
    id: string;
    code: string;
    name: { vi: string; en: string };
  };
  assignee: {
    id: string;
    displayName: string;
  } | null;
  submittedAt: string;
  waitingSeconds: number;
  priority: 'normal';
  totalMinor?: number;
  currency?: string;
};

export type StaffTimelineItem = {
  id: string;
  previousStatus: string | null;
  nextStatus: string;
  actorType: 'guest' | 'staff' | 'system';
  actorId: string | null;
  reason: string | null;
  version: number;
  createdAt: string;
};

export type StaffConversationMessage = {
  id: string;
  sequence: number;
  role: string;
  source: string;
  originalLanguage: string | null;
  originalText: string;
  translatedText: string | null;
  createdAt: string;
};

export type StaffRequestDetail = {
  kind: 'request';
  request: GuestRequest;
  location: StaffWorkItemSummary['location'];
  assignee: StaffWorkItemSummary['assignee'];
  messages: StaffConversationMessage[];
  timeline: StaffTimelineItem[];
};

export type StaffOrderDetail = {
  kind: 'order';
  order: GuestOrder;
  location: StaffWorkItemSummary['location'];
  assignee: StaffWorkItemSummary['assignee'];
  messages: StaffConversationMessage[];
  timeline: StaffTimelineItem[];
};

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
  organization_id: string;
  property_id: string;
  guest_session_id: string;
  conversation_id: string;
  request_draft_id: string;
  status: GuestRequestStatus;
  version: number;
  request_type: GuestRequest['requestType'];
  title: string;
  details: string;
  locale: string;
  metadata: Record<string, unknown>;
  assigned_staff_id: string | null;
  submitted_at: Date | string;
  accepted_at: Date | string | null;
  rejected_at: Date | string | null;
  cancelled_at: Date | string | null;
  in_progress_at: Date | string | null;
  completed_at: Date | string | null;
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
  organization_id: string;
  property_id: string;
  guest_session_id: string;
  conversation_id: string;
  order_draft_id: string;
  status: GuestOrderStatus;
  version: number;
  title: string;
  items: OrderDraftItem[];
  currency: string;
  subtotal_minor: number;
  total_minor: number;
  locale: string;
  notes: string;
  metadata: Record<string, unknown>;
  assigned_staff_id: string | null;
  submitted_at: Date | string;
  confirmed_at: Date | string | null;
  preparing_at: Date | string | null;
  ready_at: Date | string | null;
  delivering_at: Date | string | null;
  cancelled_at: Date | string | null;
  completed_at: Date | string | null;
};

type StaffWorkRow = {
  kind: 'request' | 'order';
  id: string;
  status: GuestRequestStatus | GuestOrderStatus;
  version: number;
  title: string;
  summary: string;
  locale: string;
  conversation_id: string;
  submitted_at: Date | string;
  location_id: string;
  location_code: string;
  location_name: { vi: string; en: string };
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  total_minor: number | null;
  currency: string | null;
};

type StaffMessageRow = {
  id: string;
  sequence: number;
  role: string;
  source: string;
  original_language: string | null;
  original_text: string;
  translated_text: string | null;
  created_at: Date | string;
};

type StaffTimelineRow = {
  id: string;
  previous_status: string | null;
  next_status: string;
  actor_type: 'guest' | 'staff' | 'system';
  actor_id: string | null;
  reason: string | null;
  version: number;
  created_at: Date | string;
};

type QueryExecutor = Sql | TransactionSql;

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string) {
  return toDate(value).toISOString();
}

function toNullableIso(value: Date | string | null) {
  return value ? toIso(value) : null;
}

function normalizeOrderItems(items: OrderDraftItem[]): OrderDraftItem[] {
  return items.map((item) => ({
    itemId: item.itemId,
    label: item.label,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor ?? 0,
    currency: item.currency ?? 'USD',
    optionsSnapshot: item.optionsSnapshot ?? {},
    notes: item.notes ?? '',
    metadata: item.metadata ?? {},
  }));
}

function totalMinor(items: OrderDraftItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * (item.unitPriceMinor ?? 0), 0);
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
    version: row.version,
    requestType: row.request_type,
    title: row.title,
    details: row.details,
    locale: row.locale,
    metadata: row.metadata,
    assignedStaffId: row.assigned_staff_id,
    submittedAt: toIso(row.submitted_at),
    acceptedAt: toNullableIso(row.accepted_at),
    rejectedAt: toNullableIso(row.rejected_at),
    cancelledAt: toNullableIso(row.cancelled_at),
    inProgressAt: toNullableIso(row.in_progress_at),
    completedAt: toNullableIso(row.completed_at),
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
    version: row.version,
    title: row.title,
    items: normalizeOrderItems(row.items),
    currency: row.currency,
    subtotalMinor: row.subtotal_minor,
    totalMinor: row.total_minor,
    locale: row.locale,
    notes: row.notes,
    metadata: row.metadata,
    assignedStaffId: row.assigned_staff_id,
    submittedAt: toIso(row.submitted_at),
    confirmedAt: toNullableIso(row.confirmed_at),
    preparingAt: toNullableIso(row.preparing_at),
    readyAt: toNullableIso(row.ready_at),
    deliveringAt: toNullableIso(row.delivering_at),
    cancelledAt: toNullableIso(row.cancelled_at),
    completedAt: toNullableIso(row.completed_at),
  };
}

function toStaffWorkItem(row: StaffWorkRow): StaffWorkItemSummary {
  const submittedAt = toIso(row.submitted_at);
  const item: StaffWorkItemSummary = {
    kind: row.kind,
    id: row.id,
    status: row.status,
    version: row.version,
    title: row.title,
    summary: row.summary,
    locale: row.locale,
    conversationId: row.conversation_id,
    location: {
      id: row.location_id,
      code: row.location_code,
      name: row.location_name,
    },
    assignee:
      row.assigned_staff_id && row.assigned_staff_name
        ? { id: row.assigned_staff_id, displayName: row.assigned_staff_name }
        : null,
    submittedAt,
    waitingSeconds: Math.max(0, Math.floor((Date.now() - Date.parse(submittedAt)) / 1000)),
    priority: 'normal',
  };
  if (row.total_minor !== null && row.currency) {
    item.totalMinor = row.total_minor;
    item.currency = row.currency;
  }
  return item;
}

function toStaffMessage(row: StaffMessageRow): StaffConversationMessage {
  return {
    id: row.id,
    sequence: row.sequence,
    role: row.role,
    source: row.source,
    originalLanguage: row.original_language,
    originalText: row.original_text,
    translatedText: row.translated_text,
    createdAt: toIso(row.created_at),
  };
}

function toStaffTimeline(row: StaffTimelineRow): StaffTimelineItem {
  return {
    id: row.id,
    previousStatus: row.previous_status,
    nextStatus: row.next_status,
    actorType: row.actor_type,
    actorId: row.actor_id,
    reason: row.reason,
    version: row.version,
    createdAt: toIso(row.created_at),
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
  const items = normalizeOrderItems(input.items);
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
      ${JSON.stringify(items)}::jsonb,
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

async function appendRequestHistory(
  tx: QueryExecutor,
  row: GuestRequestRow,
  input: {
    previousStatus: GuestRequestStatus | null;
    nextStatus: GuestRequestStatus;
    actorType: 'guest' | 'staff' | 'system';
    actorId?: string | null;
    reason?: string | undefined;
    idempotencyKey?: string | undefined;
  },
) {
  await tx`
    INSERT INTO request_status_history (
      organization_id,
      property_id,
      request_id,
      previous_status,
      next_status,
      actor_type,
      actor_id,
      reason,
      idempotency_key,
      version
    )
    VALUES (
      ${row.organization_id}::uuid,
      ${row.property_id}::uuid,
      ${row.id}::uuid,
      ${input.previousStatus},
      ${input.nextStatus},
      ${input.actorType},
      ${input.actorId ?? null}::uuid,
      ${input.reason ?? null},
      ${input.idempotencyKey ?? null},
      ${row.version}
    )
  `;
}

async function appendOrderHistory(
  tx: QueryExecutor,
  row: GuestOrderRow,
  input: {
    previousStatus: GuestOrderStatus | null;
    nextStatus: GuestOrderStatus;
    actorType: 'guest' | 'staff' | 'system';
    actorId?: string | null;
    reason?: string | undefined;
    idempotencyKey?: string | undefined;
  },
) {
  await tx`
    INSERT INTO order_status_history (
      organization_id,
      property_id,
      order_id,
      previous_status,
      next_status,
      actor_type,
      actor_id,
      reason,
      idempotency_key,
      version
    )
    VALUES (
      ${row.organization_id}::uuid,
      ${row.property_id}::uuid,
      ${row.id}::uuid,
      ${input.previousStatus},
      ${input.nextStatus},
      ${input.actorType},
      ${input.actorId ?? null}::uuid,
      ${input.reason ?? null},
      ${input.idempotencyKey ?? null},
      ${row.version}
    )
  `;
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
      throw new ApiError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key was used for another draft.',
      );
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
      throw new ApiError(
        409,
        'CONVERSATION_CLOSED',
        'Conversation is not accepting confirmations.',
      );
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
    await appendRequestHistory(tx, requestRows[0]!, {
      previousStatus: null,
      nextStatus: 'submitted',
      actorType: 'guest',
      actorId: session.id,
      idempotencyKey: input.idempotencyKey,
    });

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
      throw new ApiError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key was used for another draft.',
      );
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
      throw new ApiError(
        409,
        'CONVERSATION_CLOSED',
        'Conversation is not accepting confirmations.',
      );
    }
    if (toDate(conversation.retention_expires_at).getTime() <= Date.now()) {
      throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
    }

    const items = normalizeOrderItems(draft.items);
    const currency = items[0]?.currency ?? 'USD';
    const subtotal = totalMinor(items);
    const orderRows = await tx<GuestOrderRow[]>`
      INSERT INTO guest_orders (
        organization_id,
        property_id,
        guest_session_id,
        conversation_id,
        order_draft_id,
        title,
        items,
        currency,
        subtotal_minor,
        total_minor,
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
        ${JSON.stringify(items)}::jsonb,
        ${currency},
        ${subtotal},
        ${subtotal},
        ${draft.locale},
        ${draft.notes},
        ${JSON.stringify(draft.metadata)}::jsonb,
        ${input.idempotencyKey}
      )
      RETURNING *
    `;
    const order = toGuestOrder(orderRows[0]!);
    await appendOrderHistory(tx, orderRows[0]!, {
      previousStatus: null,
      nextStatus: 'submitted',
      actorType: 'guest',
      actorId: session.id,
      idempotencyKey: input.idempotencyKey,
    });

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

export type WorkItemScope = {
  organizationId: string;
  propertyId: string;
};

export async function loadRequestScope(
  app: FastifyInstance,
  requestId: string,
): Promise<WorkItemScope | null> {
  const rows = await app.sql<Array<{ organization_id: string; property_id: string }>>`
    SELECT organization_id, property_id
    FROM guest_requests
    WHERE id = ${requestId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? { organizationId: row.organization_id, propertyId: row.property_id } : null;
}

export async function loadOrderScope(
  app: FastifyInstance,
  orderId: string,
): Promise<WorkItemScope | null> {
  const rows = await app.sql<Array<{ organization_id: string; property_id: string }>>`
    SELECT organization_id, property_id
    FROM guest_orders
    WHERE id = ${orderId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? { organizationId: row.organization_id, propertyId: row.property_id } : null;
}

export async function listGuestWorkItems(
  app: FastifyInstance,
  session: GuestSession,
): Promise<{ items: GuestWorkItem[] }> {
  const requestRows = await app.sql<GuestRequestRow[]>`
    SELECT *
    FROM guest_requests
    WHERE organization_id = ${session.organizationId}::uuid
      AND property_id = ${session.propertyId}::uuid
      AND guest_session_id = ${session.id}::uuid
    ORDER BY submitted_at DESC
    LIMIT 50
  `;
  const orderRows = await app.sql<GuestOrderRow[]>`
    SELECT *
    FROM guest_orders
    WHERE organization_id = ${session.organizationId}::uuid
      AND property_id = ${session.propertyId}::uuid
      AND guest_session_id = ${session.id}::uuid
    ORDER BY submitted_at DESC
    LIMIT 50
  `;
  const items = [
    ...requestRows.map((row) => ({ ...toGuestRequest(row), kind: 'request' as const })),
    ...orderRows.map((row) => ({ ...toGuestOrder(row), kind: 'order' as const })),
  ].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  return { items };
}

export async function getGuestRequest(
  app: FastifyInstance,
  session: GuestSession,
  requestId: string,
): Promise<{ request: GuestRequest }> {
  const rows = await app.sql<GuestRequestRow[]>`
    SELECT *
    FROM guest_requests
    WHERE id = ${requestId}::uuid
      AND organization_id = ${session.organizationId}::uuid
      AND property_id = ${session.propertyId}::uuid
      AND guest_session_id = ${session.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  }
  return { request: toGuestRequest(row) };
}

export async function getGuestOrder(
  app: FastifyInstance,
  session: GuestSession,
  orderId: string,
): Promise<{ order: GuestOrder }> {
  const rows = await app.sql<GuestOrderRow[]>`
    SELECT *
    FROM guest_orders
    WHERE id = ${orderId}::uuid
      AND organization_id = ${session.organizationId}::uuid
      AND property_id = ${session.propertyId}::uuid
      AND guest_session_id = ${session.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  return { order: toGuestOrder(row) };
}

const terminalRequestStatuses = new Set<GuestRequestStatus>(['completed', 'rejected', 'cancelled']);
const terminalOrderStatuses = new Set<GuestOrderStatus>(['completed', 'cancelled']);

function matchesStaffQueue(
  item: StaffWorkItemSummary,
  queue: StaffWorkQueue,
  staffUserId: string,
) {
  if (queue === 'all') return true;
  if (queue === 'my_work') return item.assignee?.id === staffUserId;
  const terminal =
    item.kind === 'request'
      ? terminalRequestStatuses.has(item.status as GuestRequestStatus)
      : terminalOrderStatuses.has(item.status as GuestOrderStatus);
  if (queue === 'history') return terminal;
  return !item.assignee && !terminal;
}

export async function listStaffWorkItems(
  app: FastifyInstance,
  scope: WorkItemScope,
  input: {
    queue: StaffWorkQueue;
    staffUserId: string;
    status?: string | undefined;
  },
): Promise<{ items: StaffWorkItemSummary[] }> {
  const requestRows = await app.sql<StaffWorkRow[]>`
    SELECT
      'request' AS kind,
      r.id,
      r.status,
      r.version,
      r.title,
      r.details AS summary,
      r.locale,
      r.conversation_id,
      r.submitted_at,
      s.location_id,
      l.code AS location_code,
      l.name AS location_name,
      r.assigned_staff_id,
      u.display_name AS assigned_staff_name,
      NULL::integer AS total_minor,
      NULL::char(3) AS currency
    FROM guest_requests r
    INNER JOIN guest_sessions s ON s.id = r.guest_session_id
    INNER JOIN locations l ON l.id = s.location_id
    LEFT JOIN users u ON u.id = r.assigned_staff_id
    WHERE r.organization_id = ${scope.organizationId}::uuid
      AND r.property_id = ${scope.propertyId}::uuid
    ORDER BY r.submitted_at DESC
    LIMIT 100
  `;
  const orderRows = await app.sql<StaffWorkRow[]>`
    SELECT
      'order' AS kind,
      o.id,
      o.status,
      o.version,
      o.title,
      o.notes AS summary,
      o.locale,
      o.conversation_id,
      o.submitted_at,
      s.location_id,
      l.code AS location_code,
      l.name AS location_name,
      o.assigned_staff_id,
      u.display_name AS assigned_staff_name,
      o.total_minor,
      o.currency
    FROM guest_orders o
    INNER JOIN guest_sessions s ON s.id = o.guest_session_id
    INNER JOIN locations l ON l.id = s.location_id
    LEFT JOIN users u ON u.id = o.assigned_staff_id
    WHERE o.organization_id = ${scope.organizationId}::uuid
      AND o.property_id = ${scope.propertyId}::uuid
    ORDER BY o.submitted_at DESC
    LIMIT 100
  `;
  const items = [...requestRows, ...orderRows]
    .map(toStaffWorkItem)
    .filter((item) => matchesStaffQueue(item, input.queue, input.staffUserId))
    .filter((item) => !input.status || input.status === 'all' || item.status === input.status)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'normal' ? 1 : -1;
      if (a.waitingSeconds !== b.waitingSeconds) return b.waitingSeconds - a.waitingSeconds;
      return Date.parse(b.submittedAt) - Date.parse(a.submittedAt);
    });
  return { items };
}

async function loadStaffMessages(
  app: FastifyInstance,
  scope: WorkItemScope,
  conversationId: string,
) {
  const rows = await app.sql<StaffMessageRow[]>`
    SELECT id, sequence, role, source, original_language, original_text, translated_text, created_at
    FROM messages
    WHERE organization_id = ${scope.organizationId}::uuid
      AND property_id = ${scope.propertyId}::uuid
      AND conversation_id = ${conversationId}::uuid
    ORDER BY sequence ASC
    LIMIT 100
  `;
  return rows.map(toStaffMessage);
}

async function loadRequestTimeline(app: FastifyInstance, scope: WorkItemScope, requestId: string) {
  const rows = await app.sql<StaffTimelineRow[]>`
    SELECT id, previous_status, next_status, actor_type, actor_id, reason, version, created_at
    FROM request_status_history
    WHERE organization_id = ${scope.organizationId}::uuid
      AND property_id = ${scope.propertyId}::uuid
      AND request_id = ${requestId}::uuid
    ORDER BY created_at ASC, version ASC
  `;
  return rows.map(toStaffTimeline);
}

async function loadOrderTimeline(app: FastifyInstance, scope: WorkItemScope, orderId: string) {
  const rows = await app.sql<StaffTimelineRow[]>`
    SELECT id, previous_status, next_status, actor_type, actor_id, reason, version, created_at
    FROM order_status_history
    WHERE organization_id = ${scope.organizationId}::uuid
      AND property_id = ${scope.propertyId}::uuid
      AND order_id = ${orderId}::uuid
    ORDER BY created_at ASC, version ASC
  `;
  return rows.map(toStaffTimeline);
}

export async function getStaffRequestDetail(
  app: FastifyInstance,
  scope: WorkItemScope,
  requestId: string,
): Promise<StaffRequestDetail> {
  const rows = await app.sql<
    Array<
      GuestRequestRow & {
        location_id: string;
        location_code: string;
        location_name: { vi: string; en: string };
        assigned_staff_name: string | null;
      }
    >
  >`
    SELECT
      r.*,
      s.location_id,
      l.code AS location_code,
      l.name AS location_name,
      u.display_name AS assigned_staff_name
    FROM guest_requests r
    INNER JOIN guest_sessions s ON s.id = r.guest_session_id
    INNER JOIN locations l ON l.id = s.location_id
    LEFT JOIN users u ON u.id = r.assigned_staff_id
    WHERE r.id = ${requestId}::uuid
      AND r.organization_id = ${scope.organizationId}::uuid
      AND r.property_id = ${scope.propertyId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
  }
  const request = toGuestRequest(row);
  return {
    kind: 'request',
    request,
    location: { id: row.location_id, code: row.location_code, name: row.location_name },
    assignee:
      request.assignedStaffId && row.assigned_staff_name
        ? { id: request.assignedStaffId, displayName: row.assigned_staff_name }
        : null,
    messages: await loadStaffMessages(app, scope, request.conversationId),
    timeline: await loadRequestTimeline(app, scope, request.id),
  };
}

export async function getStaffOrderDetail(
  app: FastifyInstance,
  scope: WorkItemScope,
  orderId: string,
): Promise<StaffOrderDetail> {
  const rows = await app.sql<
    Array<
      GuestOrderRow & {
        location_id: string;
        location_code: string;
        location_name: { vi: string; en: string };
        assigned_staff_name: string | null;
      }
    >
  >`
    SELECT
      o.*,
      s.location_id,
      l.code AS location_code,
      l.name AS location_name,
      u.display_name AS assigned_staff_name
    FROM guest_orders o
    INNER JOIN guest_sessions s ON s.id = o.guest_session_id
    INNER JOIN locations l ON l.id = s.location_id
    LEFT JOIN users u ON u.id = o.assigned_staff_id
    WHERE o.id = ${orderId}::uuid
      AND o.organization_id = ${scope.organizationId}::uuid
      AND o.property_id = ${scope.propertyId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  const order = toGuestOrder(row);
  return {
    kind: 'order',
    order,
    location: { id: row.location_id, code: row.location_code, name: row.location_name },
    assignee:
      order.assignedStaffId && row.assigned_staff_name
        ? { id: order.assignedStaffId, displayName: row.assigned_staff_name }
        : null,
    messages: await loadStaffMessages(app, scope, order.conversationId),
    timeline: await loadOrderTimeline(app, scope, order.id),
  };
}

export async function transitionRequestStatus(
  app: FastifyInstance,
  scope: WorkItemScope,
  requestId: string,
  nextStatus: GuestRequestStatus,
  actorUserId: string,
  input: StaffTransitionRequest,
): Promise<{ request: GuestRequest; idempotentReplay: boolean }> {
  return app.sql.begin(async (tx) => {
    if (input.idempotencyKey) {
      const replayRows = await tx<Array<{ request_id: string }>>`
        SELECT request_id
        FROM request_status_history
        WHERE organization_id = ${scope.organizationId}::uuid
          AND property_id = ${scope.propertyId}::uuid
          AND idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `;
      const replay = replayRows[0];
      if (replay) {
        if (replay.request_id !== requestId) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used elsewhere.');
        }
        const request = await loadConfirmedRequest(tx, requestId);
        if (!request) {
          throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
        }
        return { request, idempotentReplay: true };
      }
    }

    const rows = await tx<GuestRequestRow[]>`
      SELECT *
      FROM guest_requests
      WHERE id = ${requestId}::uuid
        AND organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
    }
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Request version is stale.', {
        expectedVersion: input.expectedVersion,
        currentVersion: current.version,
      });
    }
    assertRequestTransition(current.status, nextStatus);

    const updatedRows = await tx<GuestRequestRow[]>`
      UPDATE guest_requests
      SET status = ${nextStatus},
          version = version + 1,
          assigned_staff_id = COALESCE(assigned_staff_id, ${actorUserId}::uuid),
          accepted_at = CASE WHEN ${nextStatus} = 'accepted' THEN now() ELSE accepted_at END,
          rejected_at = CASE WHEN ${nextStatus} = 'rejected' THEN now() ELSE rejected_at END,
          cancelled_at = CASE WHEN ${nextStatus} = 'cancelled' THEN now() ELSE cancelled_at END,
          in_progress_at = CASE WHEN ${nextStatus} = 'in_progress' THEN now() ELSE in_progress_at END,
          completed_at = CASE WHEN ${nextStatus} = 'completed' THEN now() ELSE completed_at END,
          updated_at = now()
      WHERE id = ${requestId}::uuid
        AND organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
      RETURNING *
    `;
    const updated = updatedRows[0]!;
    await appendRequestHistory(tx, updated, {
      previousStatus: current.status,
      nextStatus,
      actorType: 'staff',
      actorId: actorUserId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
    const eventKey = input.idempotencyKey
      ? `request.status:${requestId}:${input.idempotencyKey}`
      : `request.status:${requestId}:${updated.version}`;
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
        ${scope.organizationId}::uuid,
        'request',
        ${requestId},
        'request.status_changed.v1',
        ${JSON.stringify({
          propertyId: scope.propertyId,
          previousStatus: current.status,
          nextStatus,
          version: updated.version,
        })}::jsonb,
        ${eventKey}
      )
    `;
    await tx`
      INSERT INTO audit_logs (
        organization_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
      )
      VALUES (
        ${scope.organizationId}::uuid,
        ${actorUserId}::uuid,
        'request.status_changed',
        'request',
        ${requestId},
        ${JSON.stringify({
          propertyId: scope.propertyId,
          previousStatus: current.status,
          nextStatus,
          version: updated.version,
        })}::jsonb
      )
    `;

    return { request: toGuestRequest(updated), idempotentReplay: false };
  }) as Promise<{ request: GuestRequest; idempotentReplay: boolean }>;
}

export async function cancelGuestRequest(
  app: FastifyInstance,
  session: GuestSession,
  requestId: string,
  input: GuestCancelRequest,
): Promise<{ request: GuestRequest; idempotentReplay: boolean }> {
  return app.sql.begin(async (tx) => {
    const replayRows = await tx<Array<{ request_id: string }>>`
      SELECT request_id
      FROM request_status_history
      WHERE organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    const replay = replayRows[0];
    if (replay) {
      if (replay.request_id !== requestId) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used elsewhere.');
      }
      const request = await loadConfirmedRequest(tx, requestId);
      if (!request) {
        throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
      }
      return { request, idempotentReplay: true };
    }

    const rows = await tx<GuestRequestRow[]>`
      SELECT *
      FROM guest_requests
      WHERE id = ${requestId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
    }
    assertRequestTransition(current.status, 'cancelled');

    const updatedRows = await tx<GuestRequestRow[]>`
      UPDATE guest_requests
      SET status = 'cancelled',
          version = version + 1,
          cancelled_at = now(),
          updated_at = now()
      WHERE id = ${requestId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      RETURNING *
    `;
    const updated = updatedRows[0]!;
    await appendRequestHistory(tx, updated, {
      previousStatus: current.status,
      nextStatus: 'cancelled',
      actorType: 'guest',
      actorId: session.id,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
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
        ${requestId},
        'request.status_changed.v1',
        ${JSON.stringify({
          propertyId: session.propertyId,
          previousStatus: current.status,
          nextStatus: 'cancelled',
          version: updated.version,
        })}::jsonb,
        ${`request.cancel:${requestId}:${input.idempotencyKey}`}
      )
    `;
    return { request: toGuestRequest(updated), idempotentReplay: false };
  }) as Promise<{ request: GuestRequest; idempotentReplay: boolean }>;
}

export async function transitionOrderStatus(
  app: FastifyInstance,
  scope: WorkItemScope,
  orderId: string,
  nextStatus: GuestOrderStatus,
  actorUserId: string,
  input: StaffTransitionRequest,
): Promise<{ order: GuestOrder; idempotentReplay: boolean }> {
  return app.sql.begin(async (tx) => {
    if (input.idempotencyKey) {
      const replayRows = await tx<Array<{ order_id: string }>>`
        SELECT order_id
        FROM order_status_history
        WHERE organization_id = ${scope.organizationId}::uuid
          AND property_id = ${scope.propertyId}::uuid
          AND idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `;
      const replay = replayRows[0];
      if (replay) {
        if (replay.order_id !== orderId) {
          throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used elsewhere.');
        }
        const order = await loadConfirmedOrder(tx, orderId);
        if (!order) {
          throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
        }
        return { order, idempotentReplay: true };
      }
    }

    const rows = await tx<GuestOrderRow[]>`
      SELECT *
      FROM guest_orders
      WHERE id = ${orderId}::uuid
        AND organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Order version is stale.', {
        expectedVersion: input.expectedVersion,
        currentVersion: current.version,
      });
    }
    assertOrderTransition(current.status, nextStatus);

    const updatedRows = await tx<GuestOrderRow[]>`
      UPDATE guest_orders
      SET status = ${nextStatus},
          version = version + 1,
          assigned_staff_id = COALESCE(assigned_staff_id, ${actorUserId}::uuid),
          confirmed_at = CASE WHEN ${nextStatus} = 'confirmed' THEN now() ELSE confirmed_at END,
          preparing_at = CASE WHEN ${nextStatus} = 'preparing' THEN now() ELSE preparing_at END,
          ready_at = CASE WHEN ${nextStatus} = 'ready' THEN now() ELSE ready_at END,
          delivering_at = CASE WHEN ${nextStatus} = 'delivering' THEN now() ELSE delivering_at END,
          cancelled_at = CASE WHEN ${nextStatus} = 'cancelled' THEN now() ELSE cancelled_at END,
          completed_at = CASE WHEN ${nextStatus} = 'completed' THEN now() ELSE completed_at END,
          updated_at = now()
      WHERE id = ${orderId}::uuid
        AND organization_id = ${scope.organizationId}::uuid
        AND property_id = ${scope.propertyId}::uuid
      RETURNING *
    `;
    const updated = updatedRows[0]!;
    await appendOrderHistory(tx, updated, {
      previousStatus: current.status,
      nextStatus,
      actorType: 'staff',
      actorId: actorUserId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
    const eventKey = input.idempotencyKey
      ? `order.status:${orderId}:${input.idempotencyKey}`
      : `order.status:${orderId}:${updated.version}`;
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
        ${scope.organizationId}::uuid,
        'order',
        ${orderId},
        'order.status_changed.v1',
        ${JSON.stringify({
          propertyId: scope.propertyId,
          previousStatus: current.status,
          nextStatus,
          version: updated.version,
        })}::jsonb,
        ${eventKey}
      )
    `;
    await tx`
      INSERT INTO audit_logs (
        organization_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
      )
      VALUES (
        ${scope.organizationId}::uuid,
        ${actorUserId}::uuid,
        'order.status_changed',
        'order',
        ${orderId},
        ${JSON.stringify({
          propertyId: scope.propertyId,
          previousStatus: current.status,
          nextStatus,
          version: updated.version,
        })}::jsonb
      )
    `;

    return { order: toGuestOrder(updated), idempotentReplay: false };
  }) as Promise<{ order: GuestOrder; idempotentReplay: boolean }>;
}

export async function cancelGuestOrder(
  app: FastifyInstance,
  session: GuestSession,
  orderId: string,
  input: GuestCancelRequest,
): Promise<{ order: GuestOrder; idempotentReplay: boolean }> {
  return app.sql.begin(async (tx) => {
    const replayRows = await tx<Array<{ order_id: string }>>`
      SELECT order_id
      FROM order_status_history
      WHERE organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    const replay = replayRows[0];
    if (replay) {
      if (replay.order_id !== orderId) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used elsewhere.');
      }
      const order = await loadConfirmedOrder(tx, orderId);
      if (!order) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      }
      return { order, idempotentReplay: true };
    }

    const rows = await tx<GuestOrderRow[]>`
      SELECT *
      FROM guest_orders
      WHERE id = ${orderId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      FOR UPDATE
    `;
    const current = rows[0];
    if (!current) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }
    assertOrderTransition(current.status, 'cancelled');

    const updatedRows = await tx<GuestOrderRow[]>`
      UPDATE guest_orders
      SET status = 'cancelled',
          version = version + 1,
          cancelled_at = now(),
          updated_at = now()
      WHERE id = ${orderId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      RETURNING *
    `;
    const updated = updatedRows[0]!;
    await appendOrderHistory(tx, updated, {
      previousStatus: current.status,
      nextStatus: 'cancelled',
      actorType: 'guest',
      actorId: session.id,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
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
        ${orderId},
        'order.status_changed.v1',
        ${JSON.stringify({
          propertyId: session.propertyId,
          previousStatus: current.status,
          nextStatus: 'cancelled',
          version: updated.version,
        })}::jsonb,
        ${`order.cancel:${orderId}:${input.idempotencyKey}`}
      )
    `;
    return { order: toGuestOrder(updated), idempotentReplay: false };
  }) as Promise<{ order: GuestOrder; idempotentReplay: boolean }>;
}
