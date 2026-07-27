import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  guestCancelRequestSchema,
  guestDraftConfirmRequestSchema,
  guestOrderDraftCreateRequestSchema,
  guestOrderStatusSchema,
  guestRequestDraftCreateRequestSchema,
  guestRequestStatusSchema,
  staffTransitionRequestSchema,
} from '@guestportal/contracts';
import { z } from 'zod';
import { assertCan, toAuthzContext } from '../auth-context.js';
import { ApiError } from '../errors.js';
import { requireActiveGuestSession } from '../services/guest-context.js';
import {
  cancelGuestOrder,
  cancelGuestRequest,
  confirmOrderDraft,
  confirmRequestDraft,
  createOrderDraft,
  createRequestDraft,
  getGuestOrder,
  getGuestRequest,
  listGuestWorkItems,
  loadOrderScope,
  loadRequestScope,
  transitionOrderStatus,
  transitionRequestStatus,
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
  permission: 'request.transition' | 'order.transition',
) {
  if (!request.auth) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  const authz = toAuthzContext(request.auth, scope.organizationId);
  assertCan(authz, permission, scope.propertyId);
  return request.auth.userId;
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
      requests: items.filter((item) => item.kind === 'request').map((item) => {
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
      orders: items.filter((item) => item.kind === 'order').map((item) => {
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
