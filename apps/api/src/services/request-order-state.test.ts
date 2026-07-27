import { describe, expect, it } from 'vitest';
import { ApiError } from '../errors.js';
import {
  assertOrderTransition,
  assertRequestTransition,
  orderTransitions,
  requestTransitions,
} from './request-order-state.js';

describe('request/order state machines', () => {
  it('allows only documented request transitions', () => {
    expect(requestTransitions.submitted).toEqual(['accepted', 'rejected', 'cancelled']);
    expect(requestTransitions.accepted).toEqual(['in_progress', 'cancelled']);
    expect(requestTransitions.in_progress).toEqual(['completed', 'cancelled']);

    expect(() => assertRequestTransition('submitted', 'accepted')).not.toThrow();
    expect(() => assertRequestTransition('accepted', 'in_progress')).not.toThrow();
    expect(() => assertRequestTransition('in_progress', 'completed')).not.toThrow();
  });

  it('rejects invalid request transitions', () => {
    expect(() => assertRequestTransition('submitted', 'completed')).toThrow(ApiError);
    expect(() => assertRequestTransition('completed', 'cancelled')).toThrow(ApiError);
  });

  it('allows only documented order transitions', () => {
    expect(orderTransitions.submitted).toEqual(['confirmed', 'cancelled']);
    expect(orderTransitions.confirmed).toEqual(['preparing', 'cancelled']);
    expect(orderTransitions.ready).toEqual(['delivering', 'completed', 'cancelled']);

    expect(() => assertOrderTransition('submitted', 'confirmed')).not.toThrow();
    expect(() => assertOrderTransition('confirmed', 'preparing')).not.toThrow();
    expect(() => assertOrderTransition('ready', 'delivering')).not.toThrow();
  });

  it('rejects invalid order transitions', () => {
    expect(() => assertOrderTransition('submitted', 'ready')).toThrow(ApiError);
    expect(() => assertOrderTransition('completed', 'cancelled')).toThrow(ApiError);
  });
});
