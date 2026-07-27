import { z } from 'zod';
import { ApiError } from '../errors.js';

export const GEMINI_LIVE_DEFAULT_MODEL = 'models/gemini-3.1-flash-live-preview';
export const GEMINI_LIVE_NEW_SESSION_TTL_MS = 60_000;
export const GEMINI_LIVE_SESSION_TTL_MS = 30 * 60_000;

const geminiAuthTokenResponseSchema = z.object({
  name: z.string().trim().min(1),
  expireTime: z.string().datetime().optional(),
  newSessionExpireTime: z.string().datetime().optional(),
});

export type GeminiLiveTokenRequest = {
  apiKey: string;
  model: string;
  now?: Date;
  fetchImpl?: typeof fetch;
};

export type GeminiLiveToken = {
  token: string;
  model: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  uses: 1;
};

function isoAt(now: Date, ttlMs: number) {
  return new Date(now.getTime() + ttlMs).toISOString();
}

export function normalizeGeminiLiveModel(model: string) {
  return model.includes('/') ? model : `models/${model}`;
}

export async function createGeminiLiveEphemeralToken({
  apiKey,
  model,
  now = new Date(),
  fetchImpl = fetch,
}: GeminiLiveTokenRequest): Promise<GeminiLiveToken> {
  const normalizedModel = normalizeGeminiLiveModel(model);
  const expiresAt = isoAt(now, GEMINI_LIVE_SESSION_TTL_MS);
  const newSessionExpiresAt = isoAt(now, GEMINI_LIVE_NEW_SESSION_TTL_MS);
  const response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime: expiresAt,
      newSessionExpireTime: newSessionExpiresAt,
      fieldMask: 'model,generationConfig.responseModalities,sessionResumption',
      bidiGenerateContentSetup: {
        model: normalizedModel,
        generationConfig: {
          responseModalities: ['AUDIO'],
        },
        sessionResumption: {},
      },
    }),
  });

  if (!response.ok) {
    throw new ApiError(502, 'GEMINI_TOKEN_CREATE_FAILED', 'Gemini token provisioning failed.', {
      status: response.status,
    });
  }

  const parsed = geminiAuthTokenResponseSchema.parse(await response.json());
  return {
    token: parsed.name,
    model: normalizedModel,
    expiresAt: parsed.expireTime ?? expiresAt,
    newSessionExpiresAt: parsed.newSessionExpireTime ?? newSessionExpiresAt,
    uses: 1,
  };
}
