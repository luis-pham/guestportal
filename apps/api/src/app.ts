import Fastify from 'fastify';
import { createLogger } from '@guestportal/observability';

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });
  const log = createLogger({ service: 'api' });

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/v1/ready', async () => {
    return {
      status: 'ready',
      phase: '00',
    };
  });

  app.addHook('onResponse', async (request, reply) => {
    log.info('request.completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
    });
  });

  return app;
}
