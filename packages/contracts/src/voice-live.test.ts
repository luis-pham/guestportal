import { describe, expect, it } from 'vitest';
import {
  voiceLiveSessionCreateRequestSchema,
  voiceLiveSessionCreateResponseSchema,
} from './voice-live.js';

describe('voice live contracts', () => {
  it('requires a scoped conversation for token creation', () => {
    expect(() => voiceLiveSessionCreateRequestSchema.parse({})).toThrow();
    expect(
      voiceLiveSessionCreateRequestSchema.parse({
        conversationId: '11111111-1111-4111-8111-111111111111',
        locale: 'vi',
      }),
    ).toEqual({
      conversationId: '11111111-1111-4111-8111-111111111111',
      locale: 'vi',
    });
  });

  it('accepts only short-lived Gemini ephemeral token responses', () => {
    const response = voiceLiveSessionCreateResponseSchema.parse({
      liveSession: {
        token: 'auth_tokens/test-token',
        tokenType: 'gemini_ephemeral',
        model: 'models/gemini-3.1-flash-live-preview',
        conversationId: '11111111-1111-4111-8111-111111111111',
        locale: 'vi',
        newSessionExpiresAt: '2026-07-27T14:00:00.000Z',
        expiresAt: '2026-07-27T14:29:00.000Z',
        uses: 1,
        constraints: {
          responseModalities: ['AUDIO'],
          sessionResumption: true,
        },
      },
    });

    expect(response.liveSession.tokenType).toBe('gemini_ephemeral');
    expect(JSON.stringify(response)).not.toContain('GEMINI_API_KEY');
  });
});
