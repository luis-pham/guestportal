import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { assets } from '@guestportal/db';
import { createR2Storage } from '@guestportal/storage';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const hasR2 = Boolean(process.env.R2_ACCOUNT_ID || process.env.S3_ENDPOINT);
const describeIntegration = databaseUrl && hasR2 ? describe : describe.skip;

describeIntegration('knowledge source upload lifecycle', () => {
  let app: FastifyInstance;
  const createdKeys: string[] = [];

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
    const storage = createR2Storage();
    for (const key of createdKeys) {
      try {
        await storage.deleteObject(key);
      } catch {
        // best effort
      }
    }
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
    const body = response.json() as { activeOrganizationId: string };
    return { cookie: `gp_session=${cookie!.value}`, body };
  }

  it('uploads a real text file, tracks status, and denies cross-tenant access', async () => {
    const owner = await login('owner@aurora.test');
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
    });
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;

    const content = Buffer.from('Wi-Fi password is aurora-guest.\nPool hours: 6am-10pm.\n', 'utf8');
    const presign = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      headers: { cookie: owner.cookie },
      payload: {
        purpose: 'knowledge_source',
        filename: 'wifi-guide.txt',
        mimeType: 'text/plain',
        sizeBytes: content.byteLength,
        propertyId,
      },
    });
    expect(presign.statusCode).toBe(200);
    const presignBody = presign.json() as {
      assetId: string;
      uploadUrl: string;
      requiredHeaders: Record<string, string>;
    };

    const put = await fetch(presignBody.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        ...presignBody.requiredHeaders,
      },
      body: content,
    });
    expect(put.ok).toBe(true);

    const complete = await app.inject({
      method: 'POST',
      url: '/v1/uploads/complete',
      headers: { cookie: owner.cookie },
      payload: { assetId: presignBody.assetId },
    });
    expect(complete.statusCode).toBe(200);

    const assetRows = await app.db
      .select()
      .from(assets)
      .where(eq(assets.id, presignBody.assetId))
      .limit(1);
    if (assetRows[0]?.objectKey) createdKeys.push(assetRows[0].objectKey);

    const created = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/knowledge-sources`,
      headers: { cookie: owner.cookie },
      payload: {
        title: 'Wi-Fi guide',
        type: 'file',
        sourceLanguage: 'en',
        assetId: presignBody.assetId,
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().source.status).toBe('uploaded');
    const sourceId = created.json().source.id as string;

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/knowledge-sources/${sourceId}`,
      headers: { cookie: owner.cookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().source.status).toBe('uploaded');
    expect(detail.json().source.originalFilename).toBe('wifi-guide.txt');

    const badMime = await app.inject({
      method: 'POST',
      url: '/v1/uploads/presign',
      headers: { cookie: owner.cookie },
      payload: {
        purpose: 'knowledge_source',
        filename: 'x.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
        propertyId,
      },
    });
    expect(badMime.statusCode).toBe(400);

    const viewer = await login('viewer@aurora.test');
    const viewerCreate = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/knowledge-sources`,
      headers: { cookie: viewer.cookie },
      payload: { title: 'Nope', type: 'file' },
    });
    expect(viewerCreate.statusCode).toBe(403);

    const nomad = await login('owner@nomad.test');
    const cross = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/knowledge-sources`,
      headers: { cookie: nomad.cookie },
    });
    expect(cross.statusCode).toBe(403);
  });
});
