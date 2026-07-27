import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { voiceLiveSessionCreateRequestSchema } from '@guestportal/contracts';
import { locations, properties } from '@guestportal/db';
import { ApiError } from '../errors.js';
import {
  GUEST_SESSION_COOKIE,
  resolveGuestSession,
} from '../services/guest-sessions.js';
import { consumeRateLimit } from '../services/rate-limit.js';
import {
  GEMINI_LIVE_DEFAULT_MODEL,
  createGeminiLiveEphemeralToken,
} from '../services/gemini-live.js';

const LIVE_TOKEN_LIMIT = 6;
const LIVE_TOKEN_WINDOW_MS = 60_000;

type VoiceRouteOptions = {
  geminiTokenFetch?: typeof fetch;
};

type ConversationVoiceScopeRow = {
  id: string;
  status: 'active' | 'handed_off' | 'closed' | 'expired';
  locale: string;
  retention_expires_at: Date | string;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function registerVoiceLiveRoutes(
  app: FastifyInstance,
  options: VoiceRouteOptions = {},
) {
  app.post('/v1/guest/live-sessions', async (request, reply) => {
    const body = voiceLiveSessionCreateRequestSchema.parse(request.body ?? {});
    const cookieToken = request.cookies[GUEST_SESSION_COOKIE];
    if (!cookieToken) {
      throw new ApiError(401, 'GUEST_SESSION_REQUIRED', 'Guest session required.');
    }

    const session = await resolveGuestSession(app.db, cookieToken);
    if (!session) {
      throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
    }

    const limit = consumeRateLimit(
      `gemini-token:${session.id}:${request.ip || 'unknown'}`,
      LIVE_TOKEN_LIMIT,
      LIVE_TOKEN_WINDOW_MS,
    );
    if (!limit.allowed) {
      reply.header('Retry-After', String(limit.retryAfterSeconds));
      throw new ApiError(429, 'RATE_LIMITED', 'Too many live token requests.');
    }

    const activeContext = await app.db
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
    if (!activeContext[0]) {
      throw new ApiError(401, 'GUEST_SESSION_INVALID', 'Guest session is missing or expired.');
    }

    const rows = await app.sql<ConversationVoiceScopeRow[]>`
      SELECT id, status, locale, retention_expires_at
      FROM conversations
      WHERE id = ${body.conversationId}::uuid
        AND organization_id = ${session.organizationId}::uuid
        AND property_id = ${session.propertyId}::uuid
        AND guest_session_id = ${session.id}::uuid
      LIMIT 1
    `;
    const conversation = rows[0];
    if (!conversation) {
      throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }
    if (
      conversation.status === 'expired' ||
      toDate(conversation.retention_expires_at).getTime() <= Date.now()
    ) {
      throw new ApiError(410, 'CONVERSATION_EXPIRED', 'Conversation transcript has expired.');
    }
    if (conversation.status !== 'active') {
      throw new ApiError(409, 'CONVERSATION_CLOSED', 'Conversation is not accepting voice.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ApiError(503, 'GEMINI_CREDENTIAL_MISSING', 'Gemini credential is not configured.');
    }

    const model = process.env.GEMINI_LIVE_MODEL ?? GEMINI_LIVE_DEFAULT_MODEL;
    const tokenRequest = {
      apiKey,
      model,
      ...(options.geminiTokenFetch ? { fetchImpl: options.geminiTokenFetch } : {}),
    };
    const token = await createGeminiLiveEphemeralToken(tokenRequest);

    return {
      liveSession: {
        token: token.token,
        tokenType: 'gemini_ephemeral',
        model: token.model,
        conversationId: conversation.id,
        locale: body.locale ?? conversation.locale,
        newSessionExpiresAt: token.newSessionExpiresAt,
        expiresAt: token.expiresAt,
        uses: token.uses,
        constraints: {
          responseModalities: ['AUDIO'],
          sessionResumption: true,
        },
      },
    };
  });
}
