import { createLogger } from '@guestportal/observability';
import { buildApp } from './app.js';

const log = createLogger({ service: 'api' });
const port = Number(process.env.PORT ?? 4000);
const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error('AUTH_COOKIE_SECRET must be at least 32 characters');
}

const app = await buildApp({
  databaseUrl,
  cookieSecret,
});

try {
  await app.listen({ port, host: '0.0.0.0' });
  log.info('api.started', { port });
} catch (error) {
  log.error('api.failed_to_start', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
