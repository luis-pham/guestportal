import { describe, expect, it, vi } from 'vitest';
import { REDACTED } from './redaction.js';
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

  it('redacts secrets, session tokens, contact fields, and nested tenant content', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = createLogger({ service: 'api', level: 'info' });

    logger.error('failed for owner@example.test', {
      authorization: 'Bearer live-token-value-1234567890',
      guestEmail: 'guest@example.test',
      nested: {
        sessionToken: 'sess_1234567890abcdef1234567890',
        transcript: 'guest asked for room 402',
      },
      safe: 'request.failed',
    });

    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      msg: string;
      authorization: string;
      guestEmail: string;
      nested: { sessionToken: string; transcript: string };
      safe: string;
    };

    expect(payload.msg).toBe(`failed for ${REDACTED}`);
    expect(payload.authorization).toBe(REDACTED);
    expect(payload.guestEmail).toBe(REDACTED);
    expect(payload.nested.sessionToken).toBe(REDACTED);
    expect(payload.nested.transcript).toBe(REDACTED);
    expect(payload.safe).toBe('request.failed');
    spy.mockRestore();
  });
});
