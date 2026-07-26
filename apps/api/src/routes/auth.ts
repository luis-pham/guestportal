import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  createSession,
  resolveSession,
  revokeSession,
  verifyPassword,
} from '@guestportal/auth';
import { auditLogs, users } from '@guestportal/db';
import { ApiError } from '../errors.js';
import { loadMemberships } from '../services/memberships.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organizationId: z.string().uuid().optional(),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/v1/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const found = await app.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = found[0];
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const memberships = await loadMemberships(app.db, user.id);
    if (!user.isPlatformAdmin && memberships.length === 0) {
      throw new ApiError(403, 'NO_MEMBERSHIP', 'User has no organization membership.');
    }

    const activeOrganizationId = body.organizationId ?? memberships[0]?.organizationId ?? null;
    if (
      activeOrganizationId &&
      !user.isPlatformAdmin &&
      !memberships.some((m) => m.organizationId === activeOrganizationId)
    ) {
      throw new ApiError(403, 'FORBIDDEN', 'Not a member of organization.');
    }

    const { token, session } = await createSession(app.db, {
      userId: user.id,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    await app.db.insert(auditLogs).values({
      organizationId: activeOrganizationId,
      actorUserId: user.id,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: session.id,
      metadata: { email: user.email },
    });

    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: session.expiresAt,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        locale: user.locale,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      memberships,
      activeOrganizationId,
    };
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      const resolved = await resolveSession(app.db, token);
      await revokeSession(app.db, token);
      if (resolved) {
        await app.db.insert(auditLogs).values({
          actorUserId: resolved.user.id,
          action: 'auth.logout',
          resourceType: 'session',
          resourceId: resolved.session.id,
          metadata: {},
        });
      }
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/v1/me', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    return {
      user: {
        id: request.auth.userId,
        email: request.auth.email,
        displayName: request.auth.displayName,
        locale: request.auth.locale,
        isPlatformAdmin: request.auth.isPlatformAdmin,
      },
      memberships: request.auth.memberships,
      activeOrganizationId: request.auth.activeOrganizationId,
    };
  });

  app.get('/v1/me/memberships', async (request) => {
    if (!request.auth) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    return { memberships: request.auth.memberships };
  });
}
