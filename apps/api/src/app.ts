import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { AuthorizationError } from '@guestportal/auth';
import { createLogger } from '@guestportal/observability';
import { ApiError, toErrorBody } from './errors.js';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerOrganizationRoutes } from './routes/organizations.js';
import { registerPropertyRoutes } from './routes/properties.js';

export type BuildAppOptions = {
  databaseUrl: string;
  cookieSecret: string;
};

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
  });
  const log = createLogger({ service: 'api' });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(cookie, {
    secret: options.cookieSecret,
  });
  await app.register(dbPlugin, { databaseUrl: options.databaseUrl });
  await app.register(authPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/v1/ready', async () => ({
    status: 'ready',
    phase: '01',
  }));

  await registerAuthRoutes(app);
  await registerOrganizationRoutes(app);
  await registerPropertyRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;

    if (error instanceof ZodError) {
      return reply.status(400).send(
        toErrorBody(
          new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', {
            issues: error.issues,
          }),
          requestId,
        ),
      );
    }

    if (error instanceof AuthorizationError) {
      return reply
        .status(403)
        .send(toErrorBody(new ApiError(403, 'FORBIDDEN', error.message), requestId));
    }

    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(toErrorBody(error, requestId));
    }

    if (error instanceof Error && error.message === 'NO_MEMBERSHIP') {
      return reply
        .status(403)
        .send(toErrorBody(new ApiError(403, 'FORBIDDEN', 'Forbidden'), requestId));
    }

    log.error('unhandled_error', {
      message: error instanceof Error ? error.message : String(error),
      requestId,
    });
    return reply
      .status(500)
      .send(toErrorBody(new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error.'), requestId));
  });

  app.addHook('onResponse', async (request, reply) => {
    log.info('request.completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      requestId: request.id,
    });
  });

  return app;
}
