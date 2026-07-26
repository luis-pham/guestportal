import { createLogger } from '@guestportal/observability';
import { buildApp } from './app.js';

const log = createLogger({ service: 'api' });
const port = Number(process.env.PORT ?? 4000);

const app = await buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
  log.info('api.started', { port });
} catch (error) {
  log.error('api.failed_to_start', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
