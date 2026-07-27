import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { outboxEvents, portalVersions } from '@guestportal/db';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('portal publish and rollback', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
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

  it('publishes immutably, handles concurrency/idempotency, and rolls back as new version', async () => {
    const owner = await login('owner@aurora.test');
    const list = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${owner.body.activeOrganizationId}`,
      headers: { cookie: owner.cookie },
    });
    const propertyId = (list.json() as { properties: Array<{ id: string }> }).properties[0]!.id;

    const draft = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/draft`,
      headers: { cookie: owner.cookie },
    });
    const draftVersion = draft.json().version as number;

    const key = `test-publish-${propertyId}-${Date.now()}`;
    const publish1 = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/portal/publish`,
      headers: { cookie: owner.cookie },
      payload: { expectedDraftVersion: draftVersion, idempotencyKey: key, note: 'v-test' },
    });
    expect(publish1.statusCode).toBe(200);
    const versionId = publish1.json().version.id as string;
    const versionNumber = publish1.json().version.versionNumber as number;

    const replay = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/portal/publish`,
      headers: { cookie: owner.cookie },
      payload: { expectedDraftVersion: draftVersion, idempotencyKey: key },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().idempotentReplay).toBe(true);
    expect(replay.json().version.id).toBe(versionId);

    const conflict = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/portal/publish`,
      headers: { cookie: owner.cookie },
      payload: {
        expectedDraftVersion: draftVersion + 999,
        idempotencyKey: `${key}-conflict`,
      },
    });
    expect(conflict.statusCode).toBe(409);

    // Immutability: direct update attempt should not exist; checksum remains stable via select
    const rows = await app.db
      .select()
      .from(portalVersions)
      .where(and(eq(portalVersions.id, versionId), eq(portalVersions.propertyId, propertyId)))
      .limit(1);
    expect(rows[0]?.checksumSha256).toBe(publish1.json().version.checksumSha256);

    const events = await app.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.idempotencyKey, key))
      .limit(1);
    expect(events[0]?.eventType).toBe('portal.published');

    const restore = await app.inject({
      method: 'POST',
      url: `/v1/properties/${propertyId}/portal/versions/${versionId}/restore`,
      headers: { cookie: owner.cookie },
      payload: { note: 'rollback test' },
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json().version.versionNumber).toBeGreaterThan(versionNumber);
    expect(restore.json().version.restoredFromVersionId).toBe(versionId);

    const versions = await app.inject({
      method: 'GET',
      url: `/v1/properties/${propertyId}/portal/versions`,
      headers: { cookie: owner.cookie },
    });
    expect(versions.statusCode).toBe(200);
    expect(versions.json().versions.length).toBeGreaterThanOrEqual(2);
  });
});
