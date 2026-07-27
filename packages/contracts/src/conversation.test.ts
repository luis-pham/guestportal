import { describe, expect, it } from 'vitest';
import {
  conversationCreateRequestSchema,
  conversationDetailResponseSchema,
  guestMessageCreateRequestSchema,
} from './conversation.js';

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

describe('conversation contracts', () => {
  it('makes transcript retention explicit on create', () => {
    const parsed = conversationCreateRequestSchema.parse({ locale: 'vi' });
    expect(parsed.retentionPolicy).toBe('standard_30_days');
  });

  it('validates guest-authored text messages only through the guest message contract', () => {
    const parsed = guestMessageCreateRequestSchema.parse({
      text: 'Xin chào, hồ bơi mở đến mấy giờ?',
      originalLanguage: 'vi',
      clientMessageId: 'mobile-1',
    });
    expect(parsed.text).toContain('hồ bơi');
    expect(() => guestMessageCreateRequestSchema.parse({ text: '' })).toThrow();
  });

  it('conversation detail response excludes tenant and session scope ids', () => {
    const parsed = conversationDetailResponseSchema.parse({
      conversation: {
        id: '11111111-1111-4111-8111-111111111111',
        status: 'active',
        locale: 'vi',
        retentionPolicy: 'standard_30_days',
        retentionExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        lastMessageSequence: 1,
        handedOffAt: null,
        closedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      messages: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          conversationId: '11111111-1111-4111-8111-111111111111',
          sequence: 1,
          role: 'guest',
          source: 'guest_web',
          originalLanguage: 'vi',
          originalText: 'Xin chào',
          translatedText: null,
          toolName: null,
          toolPayload: null,
          requestId: null,
          orderId: null,
          clientMessageId: 'mobile-1',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const serialized = JSON.stringify(parsed);
    expect(serialized).toMatch(UUID_RE);
    expect(serialized).not.toContain('organizationId');
    expect(serialized).not.toContain('propertyId');
    expect(serialized).not.toContain('guestSessionId');
  });
});
