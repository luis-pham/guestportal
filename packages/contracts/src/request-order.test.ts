import { describe, expect, it } from 'vitest';
import {
  guestDraftConfirmRequestSchema,
  guestOrderSchema,
  guestOrderDraftCreateRequestSchema,
  guestRequestSchema,
  guestRequestDraftCreateRequestSchema,
  staffTransitionRequestSchema,
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
    expect(() =>
      guestRequestDraftCreateRequestSchema.parse({ title: 'No conversation' }),
    ).toThrow();
  });

  it('validates order drafts without price or payment fields', () => {
    const parsed = guestOrderDraftCreateRequestSchema.parse({
      conversationId,
      title: 'Coffee order',
      items: [{ itemId: 'coffee', label: 'Coffee', quantity: 1 }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      unitPriceMinor: 0,
      currency: 'USD',
      optionsSnapshot: {},
    });
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

  it('validates lifecycle response snapshots and optimistic transition input', () => {
    const submittedAt = new Date().toISOString();
    const request = guestRequestSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      conversationId,
      draftId: '33333333-3333-4333-8333-333333333333',
      status: 'accepted',
      version: 2,
      requestType: 'service',
      title: 'Extra towels',
      details: '',
      locale: 'vi',
      metadata: {},
      assignedStaffId: null,
      submittedAt,
      acceptedAt: submittedAt,
      rejectedAt: null,
      cancelledAt: null,
      inProgressAt: null,
      completedAt: null,
    });
    expect(request.status).toBe('accepted');

    const order = guestOrderSchema.parse({
      id: '44444444-4444-4444-8444-444444444444',
      conversationId,
      draftId: '55555555-5555-4555-8555-555555555555',
      status: 'confirmed',
      version: 2,
      title: 'Coffee order',
      items: [{ itemId: 'coffee', label: 'Coffee', quantity: 1, unitPriceMinor: 500 }],
      currency: 'USD',
      subtotalMinor: 500,
      totalMinor: 500,
      locale: 'vi',
      notes: '',
      metadata: {},
      assignedStaffId: null,
      submittedAt,
      confirmedAt: submittedAt,
      preparingAt: null,
      readyAt: null,
      deliveringAt: null,
      cancelledAt: null,
      completedAt: null,
    });
    expect(order.items[0]?.unitPriceMinor).toBe(500);
    expect(staffTransitionRequestSchema.parse({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
  });
});
