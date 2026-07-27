import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { resetRateLimits } from './services/rate-limit.js';
import { GUEST_SESSION_COOKIE } from './services/guest-sessions.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('Gemini Live token endpoint', () => {
  let app: FastifyInstance;
  let geminiFetch: ReturnType<typeof vi.fn>;
  let originalGeminiApiKey: string | undefined;

  beforeAll(async () => {
    originalGeminiApiKey = process.env.GEMINI_API_KEY;
    geminiFetch = vi.fn(async () =>
      Response.json({
        name: 'auth_tokens/integration-ephemeral-token',
        expireTime: '2026-07-27T14:30:00.000Z',
        newSessionExpireTime: '2026-07-27T14:01:00.000Z',
      }),
    );
    app = await buildApp({
      databaseUrl: databaseUrl!,
      cookieSecret,
      geminiTokenFetch: ((input, init) => geminiFetch(input, init)) as typeof fetch,
    });
  });

  afterAll(async () => {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
    await app.close();
  });

  beforeEach(() => {
    resetRateLimits();
    geminiFetch.mockClear();
    process.env.GEMINI_API_KEY = 'test-provider-secret';
  });

  async function login(email: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((item) => item.name === 'gp_session');
    const body = response.json() as { activeOrganizationId: string };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  async function mintQr(cookie: string, organizationId: string) {
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;
    const locations = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/locations`,
      headers: { cookie },
    });
    expect(locations.statusCode).toBe(200);
    const locationId = (locations.json() as { locations: Array<{ id: string }> }).locations[0]!
      .id;
    const created = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/qr-codes`,
      headers: { cookie },
      payload: { locationId },
    });
    expect(created.statusCode).toBe(200);
    return { propertyId, token: created.json().token as string };
  }

  async function createGuestContext(email = 'owner@aurora.test') {
    const owner = await login(email);
    const qr = await mintQr(owner.cookie, owner.body.activeOrganizationId);
    const session = await app.inject({
      method: 'POST',
      url: '/v1/guest/sessions',
      payload: { token: qr.token, locale: 'vi' },
    });
    expect(session.statusCode).toBe(200);
    const guestCookie = session.cookies.find((item) => item.name === GUEST_SESSION_COOKIE);
    return {
      guestCookie: `${GUEST_SESSION_COOKIE}=${guestCookie!.value}`,
    };
  }

  async function createConversation(cookie: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/guest/conversations',
      headers: { cookie },
      payload: { locale: 'vi', retentionPolicy: 'standard_30_days' },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { conversation: { id: string } };
  }

  it('requires guest authorization and a configured provider credential', async () => {
    const missingCookie = await app.inject({
      method: 'POST',
      url: '/v1/guest/live-sessions',
      payload: { conversationId: '11111111-1111-4111-8111-111111111111' },
    });
    expect(missingCookie.statusCode).toBe(401);

    const context = await createGuestContext();
    const { conversation } = await createConversation(context.guestCookie);
    delete process.env.GEMINI_API_KEY;

    const missingCredential = await app.inject({
      method: 'POST',
      url: '/v1/guest/live-sessions',
      headers: { cookie: context.guestCookie },
      payload: { conversationId: conversation.id },
    });
    expect(missingCredential.statusCode).toBe(503);
    expect(missingCredential.json().error.code).toBe('GEMINI_CREDENTIAL_MISSING');
    expect(geminiFetch).not.toHaveBeenCalled();
  });

  it('issues scoped ephemeral tokens without leaking the provider key', async () => {
    const context = await createGuestContext();
    const { conversation } = await createConversation(context.guestCookie);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/guest/live-sessions',
      headers: { cookie: context.guestCookie },
      payload: { conversationId: conversation.id, locale: 'vi' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('test-provider-secret');
    const body = response.json() as {
      liveSession: {
        token: string;
        tokenType: string;
        conversationId: string;
        locale: string;
        uses: number;
        constraints: { responseModalities: string[]; sessionResumption: boolean };
      };
    };
    expect(body.liveSession).toMatchObject({
      token: 'auth_tokens/integration-ephemeral-token',
      tokenType: 'gemini_ephemeral',
      conversationId: conversation.id,
      locale: 'vi',
      uses: 1,
      constraints: {
        responseModalities: ['AUDIO'],
        sessionResumption: true,
      },
    });
    expect(geminiFetch).toHaveBeenCalledTimes(1);

    const [, init] = geminiFetch.mock.calls[0]!;
    const requestBody = JSON.parse(String(init.body)) as {
      bidiGenerateContentSetup: { generationConfig: { responseModalities: string[] } };
      uses: number;
    };
    expect(requestBody.uses).toBe(1);
    expect(requestBody.bidiGenerateContentSetup.generationConfig.responseModalities).toEqual([
      'AUDIO',
    ]);
  });

  it('denies cross-session conversation scope and rate limits token creation', async () => {
    const owner = await createGuestContext();
    const other = await createGuestContext();
    const { conversation } = await createConversation(owner.guestCookie);

    const crossSession = await app.inject({
      method: 'POST',
      url: '/v1/guest/live-sessions',
      headers: { cookie: other.guestCookie },
      payload: { conversationId: conversation.id },
    });
    expect(crossSession.statusCode).toBe(404);

    resetRateLimits();
    for (let i = 0; i < 6; i += 1) {
      const allowed = await app.inject({
        method: 'POST',
        url: '/v1/guest/live-sessions',
        headers: { cookie: owner.guestCookie },
        payload: { conversationId: conversation.id },
      });
      expect(allowed.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/v1/guest/live-sessions',
      headers: { cookie: owner.guestCookie },
      payload: { conversationId: conversation.id },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeTruthy();
  });
});
