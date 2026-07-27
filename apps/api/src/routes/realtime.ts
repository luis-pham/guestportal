import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { properties } from '@guestportal/db';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { ApiError } from '../errors.js';
import { requireActiveGuestSession } from '../services/guest-context.js';

type RealtimeEventRow = {
  id: string;
  organization_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  created_at: Date | string;
};

type RealtimeEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

const staffRealtimeQuerySchema = z.object({
  propertyId: z.string().uuid(),
  lastEventId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const guestRealtimeQuerySchema = z.object({
  lastEventId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRealtimeEvent(row: RealtimeEventRow): RealtimeEvent {
  return {
    id: row.id,
    type: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    occurredAt: toIso(row.created_at),
  };
}

async function loadPropertyScope(app: FastifyInstance, propertyId: string) {
  const rows = await app.db
    .select({ organizationId: properties.organizationId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  const property = rows[0];
  if (!property) {
    throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
  }
  return { organizationId: property.organizationId, propertyId };
}

async function requireStaffRealtime(
  app: FastifyInstance,
  request: FastifyRequest,
  propertyId: string,
) {
  if (!request.auth) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  const scope = await loadPropertyScope(app, propertyId);
  const authz = toAuthzContext(request.auth, scope.organizationId);
  assertCan(authz, 'request.read', propertyId);
  return scope;
}

async function listScopedOutboxEvents(
  app: FastifyInstance,
  input: {
    organizationId: string;
    propertyId: string;
    guestSessionId?: string | undefined;
    lastEventId?: string | undefined;
    since?: Date | undefined;
    limit: number;
  },
) {
  if (!input.lastEventId && !input.since) {
    const latestRows = await app.sql<RealtimeEventRow[]>`
      SELECT id, organization_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key, created_at
      FROM outbox_events
      WHERE organization_id = ${input.organizationId}::uuid
        AND payload->>'propertyId' = ${input.propertyId}
        AND (${input.guestSessionId ?? null}::uuid IS NULL OR payload->>'guestSessionId' = ${input.guestSessionId ?? null})
      ORDER BY created_at DESC, id::text DESC
      LIMIT ${input.limit}
    `;
    return latestRows.reverse().map(toRealtimeEvent);
  }

  const rows = await app.sql<RealtimeEventRow[]>`
    WITH cursor_event AS (
      SELECT created_at, id::text AS id_text
      FROM outbox_events
      WHERE id = ${input.lastEventId ?? null}::uuid
      LIMIT 1
    )
    SELECT id, organization_id, aggregate_type, aggregate_id, event_type, payload, idempotency_key, created_at
    FROM outbox_events
    WHERE organization_id = ${input.organizationId}::uuid
      AND payload->>'propertyId' = ${input.propertyId}
      AND (${input.guestSessionId ?? null}::uuid IS NULL OR payload->>'guestSessionId' = ${input.guestSessionId ?? null})
      AND (
        ${input.lastEventId ?? null}::uuid IS NULL
        OR NOT EXISTS (SELECT 1 FROM cursor_event)
        OR (
          created_at, id::text
        ) > (
          (SELECT created_at FROM cursor_event),
          (SELECT id_text FROM cursor_event)
        )
      )
      AND (${input.since ?? null}::timestamptz IS NULL OR created_at > ${input.since ?? null}::timestamptz)
    ORDER BY created_at ASC, id::text ASC
    LIMIT ${input.limit}
  `;
  return rows.map(toRealtimeEvent);
}

function writeSse(reply: FastifyReply, event: RealtimeEvent) {
  reply.raw.write(`id: ${event.id}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function streamEvents(
  request: FastifyRequest,
  reply: FastifyReply,
  load: (lastEventId: string | undefined, since: Date | undefined) => Promise<RealtimeEvent[]>,
  initialLastEventId: string | undefined,
) {
  const openedAt = initialLastEventId ? undefined : new Date();
  let lastEventId = initialLastEventId;
  let closed = false;

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  reply.raw.write('retry: 1500\n\n');

  const pump = async () => {
    if (closed || reply.raw.destroyed) return;
    try {
      const events = await load(lastEventId, openedAt);
      for (const event of events) {
        writeSse(reply, event);
        lastEventId = event.id;
      }
      if (events.length === 0) {
        reply.raw.write(': keepalive\n\n');
      }
    } catch {
      reply.raw.write('event: realtime.error\n');
      reply.raw.write('data: {"code":"REALTIME_STREAM_ERROR"}\n\n');
    }
  };

  await pump();
  const interval = setInterval(() => {
    void pump();
  }, 1500);

  request.raw.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
}

export async function registerRealtimeRoutes(app: FastifyInstance) {
  app.get('/v1/staff/realtime/events', async (request) => {
    const query = staffRealtimeQuerySchema.parse(request.query);
    const scope = await requireStaffRealtime(app, request, query.propertyId);
    const events = await listScopedOutboxEvents(app, {
      ...scope,
      lastEventId: query.lastEventId,
      limit: query.limit,
    });
    return {
      events,
      reconnectAfterMs: 1500,
      notificationsSupported: ['in_app'],
    };
  });

  app.get('/v1/staff/realtime/stream', async (request, reply) => {
    const query = staffRealtimeQuerySchema.parse(request.query);
    const scope = await requireStaffRealtime(app, request, query.propertyId);
    const headerLastEventId = request.headers['last-event-id'];
    const initialLastEventId =
      query.lastEventId ?? (Array.isArray(headerLastEventId) ? headerLastEventId[0] : headerLastEventId);
    await streamEvents(
      request,
      reply,
      (lastEventId, since) =>
        listScopedOutboxEvents(app, {
          ...scope,
          lastEventId,
          since,
          limit: query.limit,
        }),
      initialLastEventId,
    );
  });

  app.get('/v1/guest/realtime/events', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const query = guestRealtimeQuerySchema.parse(request.query);
    const events = await listScopedOutboxEvents(app, {
      organizationId: session.organizationId,
      propertyId: session.propertyId,
      guestSessionId: session.id,
      lastEventId: query.lastEventId,
      limit: query.limit,
    });
    return {
      events,
      reconnectAfterMs: 1500,
      notificationsSupported: ['in_app'],
    };
  });

  app.get('/v1/guest/realtime/stream', async (request, reply) => {
    const { session } = await requireActiveGuestSession(app, request);
    const query = guestRealtimeQuerySchema.parse(request.query);
    const headerLastEventId = request.headers['last-event-id'];
    const initialLastEventId =
      query.lastEventId ?? (Array.isArray(headerLastEventId) ? headerLastEventId[0] : headerLastEventId);
    await streamEvents(
      request,
      reply,
      (lastEventId, since) =>
        listScopedOutboxEvents(app, {
          organizationId: session.organizationId,
          propertyId: session.propertyId,
          guestSessionId: session.id,
          lastEventId,
          since,
          limit: query.limit,
        }),
      initialLastEventId,
    );
  });
}
