import { describe, expect, it, vi } from 'vitest';
import {
  GEMINI_LIVE_DEFAULT_MODEL,
  GEMINI_LIVE_NEW_SESSION_TTL_MS,
  GEMINI_LIVE_SESSION_TTL_MS,
  createGeminiLiveEphemeralToken,
  normalizeGeminiLiveModel,
} from './gemini-live.js';

describe('Gemini Live ephemeral token service', () => {
  it('normalizes model ids for Gemini API resource names', () => {
    expect(normalizeGeminiLiveModel('gemini-2.5-flash-preview-native-audio-dialog')).toBe(
      'models/gemini-2.5-flash-preview-native-audio-dialog',
    );
    expect(normalizeGeminiLiveModel(GEMINI_LIVE_DEFAULT_MODEL)).toBe(GEMINI_LIVE_DEFAULT_MODEL);
  });

  it('creates short-lived one-use scoped Live API tokens without returning the API key', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        name: 'auth_tokens/ephemeral-test-token',
      }),
    ) as unknown as typeof fetch;
    const now = new Date('2026-07-27T14:00:00.000Z');

    const token = await createGeminiLiveEphemeralToken({
      apiKey: 'provider-secret-key',
      model: GEMINI_LIVE_DEFAULT_MODEL,
      now,
      fetchImpl,
    });

    expect(token).toEqual({
      token: 'auth_tokens/ephemeral-test-token',
      model: GEMINI_LIVE_DEFAULT_MODEL,
      expiresAt: new Date(now.getTime() + GEMINI_LIVE_SESSION_TTL_MS).toISOString(),
      newSessionExpiresAt: new Date(
        now.getTime() + GEMINI_LIVE_NEW_SESSION_TTL_MS,
      ).toISOString(),
      uses: 1,
    });
    expect(JSON.stringify(token)).not.toContain('provider-secret-key');

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'provider-secret-key' });
    const body = JSON.parse(String(init?.body)) as {
      uses: number;
      expireTime: string;
      newSessionExpireTime: string;
      fieldMask: string;
      bidiGenerateContentSetup: {
        model: string;
        generationConfig: {
          responseModalities: string[];
        };
        sessionResumption: Record<string, never>;
      };
    };
    expect(body.uses).toBe(1);
    expect(body.fieldMask).toBe('model,generationConfig.responseModalities,sessionResumption');
    expect(Date.parse(body.newSessionExpireTime) - now.getTime()).toBe(
      GEMINI_LIVE_NEW_SESSION_TTL_MS,
    );
    expect(Date.parse(body.expireTime) - now.getTime()).toBe(GEMINI_LIVE_SESSION_TTL_MS);
    expect(body.bidiGenerateContentSetup).toEqual({
      model: GEMINI_LIVE_DEFAULT_MODEL,
      generationConfig: {
        responseModalities: ['AUDIO'],
      },
      sessionResumption: {},
    });
  });
});
