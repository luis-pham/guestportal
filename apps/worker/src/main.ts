import { createLogger } from '@guestportal/observability';
import { getRegisteredQueues } from './queues.js';

const log = createLogger({ service: 'worker' });

export function startWorker(): { queues: string[] } {
  const queues = getRegisteredQueues();
  log.info('worker.ready', { queues });
  return { queues };
}

startWorker();
