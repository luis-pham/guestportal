import { describe, expect, it } from 'vitest';
import {
  guestDraftConfirmRequestSchema,
  guestOrderDraftCreateRequestSchema,
  guestRequestDraftCreateRequestSchema,
} from './request-order.js';

const conversationId = '11111111-1111-4111-8111-111111111111';

describe('guest request and order contracts', () => {
  it('validates request drafts with a required conversation', () => {
    const parsed = guestRequestDraftCreateRequestSchema.parse({
      conversationId,
      requestType: 'maintenance',
      title: 'Air conditioner check',
      details: 'Room feels warm',
    });
    expect(parsed.requestType).toBe('maintenance');
    expect(() => guestRequestDraftCreateRequestSchema.parse({ title: 'No conversation' })).toThrow();
  });

  it('validates order drafts without price or payment fields', () => {
    const parsed = guestOrderDraftCreateRequestSchema.parse({
      conversationId,
      title: 'Coffee order',
      items: [{ itemId: 'coffee', label: 'Coffee', quantity: 1 }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(() =>
      guestOrderDraftCreateRequestSchema.parse({
        conversationId,
        title: 'Bad order',
        items: [{ itemId: 'coffee', label: 'Coffee', quantity: 0 }],
      }),
    ).toThrow();
  });

  it('requires idempotency keys for confirmation', () => {
    expect(guestDraftConfirmRequestSchema.parse({ idempotencyKey: 'confirm-123' })).toEqual({
      idempotencyKey: 'confirm-123',
    });
    expect(() => guestDraftConfirmRequestSchema.parse({ idempotencyKey: 'short' })).toThrow();
  });
});
