import { describe, expect, it } from 'vitest';
import { ApiError, toErrorBody } from './errors.js';

describe('api error envelope', () => {
  it('serializes a standard error body', () => {
    const body = toErrorBody(
      new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.'),
      'req_trace_id',
    );
    expect(body).toEqual({
      error: {
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found.',
        requestId: 'req_trace_id',
      },
    });
  });
});
