import type { FastifyPluginAsync } from 'fastify';
import { SESSION_COOKIE, resolveSession } from '@guestportal/auth';
import { loadMemberships } from '../services/memberships.js';
import type { RequestAuth } from '../auth-context.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuth | null;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', null);

  app.addHook('preHandler', async (request) => {
    request.auth = null;
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return;
    }

    const resolved = await resolveSession(app.db, token);
    if (!resolved) {
      return;
    }

    const memberships = await loadMemberships(app.db, resolved.user.id);
    request.auth = {
      userId: resolved.user.id,
      email: resolved.user.email,
      displayName: resolved.user.displayName,
      locale: resolved.user.locale,
      isPlatformAdmin: resolved.user.isPlatformAdmin,
      memberships,
      activeOrganizationId: memberships[0]?.organizationId ?? null,
    };
  });
};

export default authPlugin;
