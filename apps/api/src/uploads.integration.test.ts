import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createR2Storage } from '@guestportal/storage';
import { buildApp } from './app.js';

function loadDotEnv() {
  const candidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    break;
  }
}

loadDotEnv();

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const hasR2 =
  Boolean(process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
  Boolean(process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY);

const describeIntegration = databaseUrl && hasR2 ? describe : describe.skip;

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describeIntegration('uploads and assets (R2 REAL_STAGING)', () => {
  let app: FastifyInstance;
  const cleanupAssetIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
    const storage = createR2Storage();
    for (const assetId of cleanupAssetIds) {
      try {
        await app.inject({
          method: 'DELETE',
          url: `/v1/assets/${assetId}`,
          headers: { cookie: (await login('owner@aurora.test')).cookie },
        });
      } catch {
        // ignore
      }
    }
    // best-effort: also try head/delete orphans via storage if needed
    void storage;
    await app.close();
  });

  async function login(email: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((item) => item.name === 'gp_session');
    const body = response.json() as {
      memberships: Array<{ organizationId: string; propertyIds: string[] }>;
      activeOrganizationId: string;
    };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  async function firstPropertyId(cookie: string, organizationId: string) {
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    return (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;
  }

  it('rejects unauthorized and invalid content-type/size', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      payload: {
        purpose: 'branding_logo',
        filename: 'x.png',
        mimeType: 'image/png',
        sizeBytes: 100,
        propertyId: '00000000-0000-4000-8000-000000000001',
      },
    });
    expect(unauth.statusCode).toBe(401);

    const owner = await login('owner@aurora.test');
    const propertyId = await firstPropertyId(owner.cookie, owner.body.activeOrganizationId);

    const badMime = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      headers: { cookie: owner.cookie },
      payload: {
        purpose: 'branding_logo',
        filename: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        propertyId,
      },
    });
    expect(badMime.statusCode).toBe(400);

    const tooBig = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      headers: { cookie: owner.cookie },
      payload: {
        purpose: 'branding_logo',
        filename: 'x.png',
        mimeType: 'image/png',
        sizeBytes: 3 * 1024 * 1024,
        propertyId,
      },
    });
    expect(tooBig.statusCode).toBe(400);

    const viewer = await login('viewer@aurora.test');
    const forbidden = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      headers: { cookie: viewer.cookie },
      payload: {
        purpose: 'branding_logo',
        filename: 'x.png',
        mimeType: 'image/png',
        sizeBytes: png.length,
        propertyId,
      },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('presigns, uploads to R2, completes, reads, and deletes', async () => {
    const owner = await login('owner@aurora.test');
    const propertyId = await firstPropertyId(owner.cookie, owner.body.activeOrganizationId);

    const presign = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      headers: { cookie: owner.cookie },
      payload: {
        purpose: 'branding_logo',
        filename: 'logo-task-032.png',
        mimeType: 'image/png',
        sizeBytes: png.length,
        propertyId,
      },
    });
    expect(presign.statusCode).toBe(200);
    const body = presign.json() as {
      assetId: string;
      uploadUrl: string;
      requiredHeaders: Record<string, string>;
      publicUrl: string;
    };
    cleanupAssetIds.push(body.assetId);
    expect(body.uploadUrl).toContain('X-Amz-Signature');
    expect(body.requiredHeaders['Content-Type']).toBe('image/png');
    expect(body.publicUrl).toContain('/org/');

    const put = await fetch(body.uploadUrl, {
      method: 'PUT',
      headers: body.requiredHeaders,
      body: png,
    });
    expect(put.ok).toBe(true);

    const complete = await app.inject({
      method: 'POST',
      url: '/v1/uploads/complete',
      headers: { cookie: owner.cookie },
      payload: { assetId: body.assetId },
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().asset.status).toBe('ready');

    const get = await app.inject({
      method: 'GET',
      url: `/v1/assets/${body.assetId}`,
      headers: { cookie: owner.cookie },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().asset.id).toBe(body.assetId);

    // Cross-tenant denial: content manager on other org should not read aurora asset
    // Use nomad owner if available — fall back to content manager lacking portal.read on wrong scope
    const content = await login('content@aurora.test');
    // content manager can portal.read on assigned properties — still same tenant.
    // Cross-tenant: login as owner of second org if seed has nomad.
    const nomadLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'owner@nomad.test', password: 'Password123!' },
    });
    if (nomadLogin.statusCode === 200) {
      const nomadCookie = `gp_session=${nomadLogin.cookies.find((c) => c.name === 'gp_session')!.value}`;
      const cross = await app.inject({
        method: 'GET',
        url: `/v1/assets/${body.assetId}`,
        headers: { cookie: nomadCookie },
      });
      expect([403, 404]).toContain(cross.statusCode);
    }
    void content;

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/assets/${body.assetId}`,
      headers: { cookie: owner.cookie },
    });
    expect(del.statusCode).toBe(200);
    cleanupAssetIds.splice(cleanupAssetIds.indexOf(body.assetId), 1);

    const gone = await app.inject({
      method: 'GET',
      url: `/v1/assets/${body.assetId}`,
      headers: { cookie: owner.cookie },
    });
    expect(gone.statusCode).toBe(404);
  });
});
