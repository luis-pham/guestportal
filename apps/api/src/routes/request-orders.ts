import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  adminOperationListQuerySchema,
  guestCancelRequestSchema,
  guestDraftConfirmRequestSchema,
  guestOrderDraftCreateRequestSchema,
  guestRequestDraftCreateRequestSchema,
  staffClaimRequestSchema,
  staffTransitionRequestSchema,
} from '@guestportal/contracts';
import type { guestOrderStatusSchema, guestRequestStatusSchema } from '@guestportal/contracts';
import { properties } from '@guestportal/db';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { ApiError } from '../errors.js';
import { requireActiveGuestSession } from '../services/guest-context.js';
import {
  cancelGuestOrder,
  cancelGuestRequest,
  claimOrder,
  claimRequest,
  confirmOrderDraft,
  confirmRequestDraft,
  createOrderDraft,
  createRequestDraft,
  getGuestOrder,
  getGuestRequest,
  getStaffOrderDetail,
  getStaffRequestDetail,
  listAdminOperationItems,
  listGuestWorkItems,
  listStaffWorkItems,
  loadOrderScope,
  loadRequestScope,
  transitionOrderStatus,
  transitionRequestStatus,
  type StaffWorkQueue,
} from '../services/request-orders.js';

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

const requestParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const orderParamsSchema = z.object({
  orderId: z.string().uuid(),
});

const adminOperationPropertyParamsSchema = z.object({
  propertyId: z.string().uuid(),
});

const adminRequestParamsSchema = adminOperationPropertyParamsSchema.extend({
  requestId: z.string().uuid(),
});

const adminOrderParamsSchema = adminOperationPropertyParamsSchema.extend({
  orderId: z.string().uuid(),
});

const staffListQuerySchema = z.object({
  propertyId: z.string().uuid(),
  queue: z.enum(['inbox', 'my_work', 'history', 'all']).default('inbox'),
  status: z.string().trim().max(40).optional(),
});

const staffRequestTransitionByAction = {
  accept: 'accepted',
  start: 'in_progress',
  complete: 'completed',
  reject: 'rejected',
  cancel: 'cancelled',
} as const satisfies Record<string, z.infer<typeof guestRequestStatusSchema>>;

const staffOrderTransitionByAction = {
  confirm: 'confirmed',
  prepare: 'preparing',
  ready: 'ready',
  deliver: 'delivering',
  complete: 'completed',
  cancel: 'cancelled',
} as const satisfies Record<string, z.infer<typeof guestOrderStatusSchema>>;

async function requireStaffTransition(
  request: FastifyRequest,
  scope: { organizationId: string; propertyId: string },
  permission: 'request.assign' | 'request.transition' | 'order.transition',
) {
  if (!request.auth) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  const authz = toAuthzContext(request.auth, scope.organizationId);
  assertCan(authz, permission, scope.propertyId);
  return request.auth.userId;
}

async function requireStaffRead(
  app: FastifyInstance,
  request: FastifyRequest,
  propertyId: string,
  permission: 'request.read' | 'order.read' | 'conversation.read',
) {
  if (!request.auth) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  const rows = await app.db
    .select({ organizationId: properties.organizationId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  const property = rows[0];
  if (!property) {
    throw new ApiError(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
  }
  const authz = toAuthzContext(request.auth, property.organizationId);
  assertCan(authz, permission, propertyId);
  return { organizationId: property.organizationId, propertyId };
}

export async function registerRequestOrderRoutes(app: FastifyInstance) {
  app.post('/v1/guest/request-drafts', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const body = guestRequestDraftCreateRequestSchema.parse(request.body);
    return createRequestDraft(app, session, body);
  });

  app.post('/v1/guest/request-drafts/:draftId/confirm', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const params = draftParamsSchema.parse(request.params);
    const body = guestDraftConfirmRequestSchema.parse(request.body);
    return confirmRequestDraft(app, session, params.draftId, body);
  });

  app.post('/v1/guest/order-drafts', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const body = guestOrderDraftCreateRequestSchema.parse(request.body);
    return createOrderDraft(app, session, body);
  });

  app.post('/v1/guest/order-drafts/:draftId/confirm', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const params = draftParamsSchema.parse(request.params);
    const body = guestDraftConfirmRequestSchema.parse(request.body);
    return confirmOrderDraft(app, session, params.draftId, body);
  });

  app.get('/v1/guest/requests', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const { items } = await listGuestWorkItems(app, session);
    return {
      requests: items
        .filter((item) => item.kind === 'request')
        .map((item) => {
          const { kind, ...requestItem } = item;
          void kind;
          return requestItem;
        }),
    };
  });

  app.get('/v1/guest/requests/:requestId', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const params = requestParamsSchema.parse(request.params);
    return getGuestRequest(app, session, params.requestId);
  });

  app.post('/v1/guest/requests/:requestId/cancel', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const params = requestParamsSchema.parse(request.params);
    const body = guestCancelRequestSchema.parse(request.body ?? {});
    return cancelGuestRequest(app, session, params.requestId, body);
  });

  app.get('/v1/guest/orders', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const { items } = await listGuestWorkItems(app, session);
    return {
      orders: items
        .filter((item) => item.kind === 'order')
        .map((item) => {
          const { kind, ...orderItem } = item;
          void kind;
          return orderItem;
        }),
    };
  });

  app.get('/v1/guest/orders/:orderId', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const params = orderParamsSchema.parse(request.params);
    return getGuestOrder(app, session, params.orderId);
  });

  app.post('/v1/guest/orders/:orderId/cancel', async (request) => {
    const { session } = await requireActiveGuestSession(app, request);
    const params = orderParamsSchema.parse(request.params);
    const body = guestCancelRequestSchema.parse(request.body ?? {});
    return cancelGuestOrder(app, session, params.orderId, body);
  });

  app.get('/v1/staff/work-items', async (request) => {
    const query = staffListQuerySchema.parse(request.query);
    const scope = await requireStaffRead(app, request, query.propertyId, 'request.read');
    await requireStaffRead(app, request, query.propertyId, 'order.read');
    return listStaffWorkItems(app, scope, {
      queue: query.queue as StaffWorkQueue,
      staffUserId: request.auth!.userId,
      status: query.status,
    });
  });

  app.get('/v1/admin/properties/:propertyId/operations/requests', async (request) => {
    const params = adminOperationPropertyParamsSchema.parse(request.params);
    const query = adminOperationListQuerySchema.parse(request.query);
    const scope = await requireStaffRead(app, request, params.propertyId, 'request.read');
    return listAdminOperationItems(app, scope, { ...query, kind: 'request' });
  });

  app.get('/v1/admin/properties/:propertyId/operations/orders', async (request) => {
    const params = adminOperationPropertyParamsSchema.parse(request.params);
    const query = adminOperationListQuerySchema.parse(request.query);
    const scope = await requireStaffRead(app, request, params.propertyId, 'order.read');
    return listAdminOperationItems(app, scope, { ...query, kind: 'order' });
  });

  app.get('/v1/admin/properties/:propertyId/operations/requests/:requestId', async (request) => {
    const params = adminRequestParamsSchema.parse(request.params);
    const scope = await loadRequestScope(app, params.requestId);
    if (!scope || scope.propertyId !== params.propertyId) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
    }
    await requireStaffRead(app, request, params.propertyId, 'request.read');
    return { detail: await getStaffRequestDetail(app, scope, params.requestId) };
  });

  app.get('/v1/admin/properties/:propertyId/operations/orders/:orderId', async (request) => {
    const params = adminOrderParamsSchema.parse(request.params);
    const scope = await loadOrderScope(app, params.orderId);
    if (!scope || scope.propertyId !== params.propertyId) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }
    await requireStaffRead(app, request, params.propertyId, 'order.read');
    return { detail: await getStaffOrderDetail(app, scope, params.orderId) };
  });

  app.get('/v1/staff/requests', async (request) => {
    const query = staffListQuerySchema.parse(request.query);
    const scope = await requireStaffRead(app, request, query.propertyId, 'request.read');
    const { items } = await listStaffWorkItems(app, scope, {
      queue: query.queue as StaffWorkQueue,
      staffUserId: request.auth!.userId,
      status: query.status,
    });
    return { requests: items.filter((item) => item.kind === 'request') };
  });

  app.get('/v1/staff/requests/:requestId', async (request) => {
    const params = requestParamsSchema.parse(request.params);
    const scope = await loadRequestScope(app, params.requestId);
    if (!scope) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
    }
    await requireStaffRead(app, request, scope.propertyId, 'request.read');
    return getStaffRequestDetail(app, scope, params.requestId);
  });

  app.post('/v1/staff/requests/:requestId/claim', async (request) => {
    const params = requestParamsSchema.parse(request.params);
    const body = staffClaimRequestSchema.parse(request.body ?? {});
    const scope = await loadRequestScope(app, params.requestId);
    if (!scope) {
      throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
    }
    const actorUserId = await requireStaffTransition(request, scope, 'request.assign');
    return claimRequest(app, scope, params.requestId, actorUserId, body);
  });

  app.get('/v1/staff/orders', async (request) => {
    const query = staffListQuerySchema.parse(request.query);
    const scope = await requireStaffRead(app, request, query.propertyId, 'order.read');
    const { items } = await listStaffWorkItems(app, scope, {
      queue: query.queue as StaffWorkQueue,
      staffUserId: request.auth!.userId,
      status: query.status,
    });
    return { orders: items.filter((item) => item.kind === 'order') };
  });

  app.get('/v1/staff/orders/:orderId', async (request) => {
    const params = orderParamsSchema.parse(request.params);
    const scope = await loadOrderScope(app, params.orderId);
    if (!scope) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }
    await requireStaffRead(app, request, scope.propertyId, 'order.read');
    return getStaffOrderDetail(app, scope, params.orderId);
  });

  app.post('/v1/staff/orders/:orderId/claim', async (request) => {
    const params = orderParamsSchema.parse(request.params);
    const body = staffClaimRequestSchema.parse(request.body ?? {});
    const scope = await loadOrderScope(app, params.orderId);
    if (!scope) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }
    const actorUserId = await requireStaffTransition(request, scope, 'order.transition');
    return claimOrder(app, scope, params.orderId, actorUserId, body);
  });

  for (const [action, nextStatus] of Object.entries(staffRequestTransitionByAction)) {
    app.post(`/v1/staff/requests/:requestId/${action}`, async (request) => {
      const params = requestParamsSchema.parse(request.params);
      const body = staffTransitionRequestSchema.parse(request.body ?? {});
      const scope = await loadRequestScope(app, params.requestId);
      if (!scope) {
        throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.');
      }
      const actorUserId = await requireStaffTransition(request, scope, 'request.transition');
      return transitionRequestStatus(app, scope, params.requestId, nextStatus, actorUserId, body);
    });
  }

  for (const [action, nextStatus] of Object.entries(staffOrderTransitionByAction)) {
    app.post(`/v1/staff/orders/:orderId/${action}`, async (request) => {
      const params = orderParamsSchema.parse(request.params);
      const body = staffTransitionRequestSchema.parse(request.body ?? {});
      const scope = await loadOrderScope(app, params.orderId);
      if (!scope) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      }
      const actorUserId = await requireStaffTransition(request, scope, 'order.transition');
      return transitionOrderStatus(app, scope, params.orderId, nextStatus, actorUserId, body);
    });
  }
}
