import type { FastifyInstance } from 'fastify';
import {
  guestDraftConfirmRequestSchema,
  guestOrderDraftCreateRequestSchema,
  guestRequestDraftCreateRequestSchema,
} from '@guestportal/contracts';
import { z } from 'zod';
import { requireActiveGuestSession } from '../services/guest-context.js';
import {
  confirmOrderDraft,
  confirmRequestDraft,
  createOrderDraft,
  createRequestDraft,
} from '../services/request-orders.js';

const draftParamsSchema = z.object({
  draftId: z.string().uuid(),
});

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
}
