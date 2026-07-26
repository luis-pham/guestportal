import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('emits structured JSON logs at or above the configured level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ service: 'api', level: 'info' });

    logger.debug('hidden');
    logger.info('visible', { requestId: 'req_1' });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      service: string;
      msg: string;
      requestId: string;
    };
    expect(payload.service).toBe('api');
    expect(payload.msg).toBe('visible');
    expect(payload.requestId).toBe('req_1');
    spy.mockRestore();
  });
});
