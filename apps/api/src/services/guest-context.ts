import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { locations, properties } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { GUEST_SESSION_COOKIE, resolveGuestSession } from './guest-sessions.js';

export async function requireActiveGuestSession(app: FastifyInstance, request: FastifyRequest) {
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

  return { session, property: rows[0].property, location: rows[0].location };
}
