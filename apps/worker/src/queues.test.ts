import { describe, expect, it } from 'vitest';
import { getRegisteredQueues } from './queues.js';

describe('worker queues', () => {
  it('registers the documented foundation queues', () => {
    const queues = getRegisteredQueues();
    expect(queues).toContain('knowledge-ingestion');
    expect(queues).toContain('embedding');
    expect(queues).toContain('cleanup');
    expect(queues.length).toBeGreaterThanOrEqual(9);
  });
});
