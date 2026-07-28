import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { auditLogs } from '@guestportal/db';
import { buildApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

type LoginBody = {
  activeOrganizationId: string;
};

type PropertySummary = {
  id: string;
  slug: string;
};

describeIntegration('admin audit logs and exports', () => {
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
    expect(cookie?.value).toBeTruthy();
    return {
      cookie: `gp_session=${cookie!.value}`,
      body: response.json() as LoginBody,
    };
  }

  async function propertyBySlug(cookie: string, organizationId: string, slug: string) {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/properties?organizationId=${organizationId}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const property = (response.json() as { properties: PropertySummary[] }).properties.find(
      (item) => item.slug === slug,
    );
    expect(property).toBeTruthy();
    return property!;
  }

  async function firstLocation(propertyId: string) {
    const rows = await app.sql<{ id: string }[]>`
      SELECT id
      FROM locations
      WHERE property_id = ${propertyId}::uuid
      ORDER BY code
      LIMIT 1
    `;
    expect(rows[0]).toBeTruthy();
    return rows[0]!.id;
  }

  async function insertRequestFixture(input: {
    organizationId: string;
    propertyId: string;
    locationId: string;
    marker: string;
    title: string;
    details: string;
    submittedAt: string;
  }) {
    await app.sql`
      WITH session AS (
        INSERT INTO guest_sessions (
          organization_id,
          property_id,
          location_id,
          token_hash,
          locale,
          expires_at,
          created_at
        )
        VALUES (
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          ${input.locationId}::uuid,
          ${`export-session-${input.marker}`},
          'en',
          ${input.submittedAt}::timestamptz + interval '1 day',
          ${input.submittedAt}::timestamptz
        )
        RETURNING id
      ),
      conversation AS (
        INSERT INTO conversations (
          organization_id,
          property_id,
          guest_session_id,
          locale,
          retention_policy,
          retention_expires_at,
          created_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          session.id,
          'en',
          'standard_30_days',
          ${input.submittedAt}::timestamptz + interval '30 days',
          ${input.submittedAt}::timestamptz
        FROM session
        RETURNING id, guest_session_id
      ),
      draft AS (
        INSERT INTO request_drafts (
          organization_id,
          property_id,
          guest_session_id,
          conversation_id,
          status,
          request_type,
          title,
          details,
          locale,
          expires_at,
          created_at
        )
        SELECT
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          conversation.guest_session_id,
          conversation.id,
          'confirmed',
          'housekeeping',
          ${input.title},
          ${input.details},
          'en',
          ${input.submittedAt}::timestamptz + interval '1 day',
          ${input.submittedAt}::timestamptz
        FROM conversation
        RETURNING id, conversation_id, guest_session_id
      )
      INSERT INTO guest_requests (
        organization_id,
        property_id,
        guest_session_id,
        conversation_id,
        request_draft_id,
        status,
        request_type,
        title,
        details,
        locale,
        idempotency_key,
        submitted_at
      )
      SELECT
        ${input.organizationId}::uuid,
        ${input.propertyId}::uuid,
        draft.guest_session_id,
        draft.conversation_id,
        draft.id,
        'submitted',
        'housekeeping',
        ${input.title},
        ${input.details},
        'en',
        ${`export-request-${input.marker}`},
        ${input.submittedAt}::timestamptz
      FROM draft
    `;
  }

  function isoPlus(baseMs: number, offsetMs: number) {
    return new Date(baseMs + offsetMs).toISOString();
  }

  it('exports scoped CSV and protects formula-leading cells', async () => {
    const owner = await login('owner@aurora.test');
    const content = await login('content@aurora.test');
    const viewer = await login('viewer@aurora.test');
    const property = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-city-hotel',
    );
    const marker = crypto.randomUUID();
    const baseMs = Date.now() + 10 * 24 * 60 * 60 * 1000;
    const submittedAt = isoPlus(baseMs, 0);
    await insertRequestFixture({
      organizationId: owner.body.activeOrganizationId,
      propertyId: property.id,
      locationId: await firstLocation(property.id),
      marker,
      title: `=SUM(1,2) ${marker}`,
      details: `+export details ${marker}`,
      submittedAt,
    });

    const exported = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/operations/requests/export?status=submitted&dateFrom=${encodeURIComponent(submittedAt)}&dateTo=${encodeURIComponent(isoPlus(baseMs, 1000))}&limit=25`,
      headers: { cookie: owner.cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.headers['x-export-row-count']).toBe('1');
    expect(exported.body).toContain(`"'=SUM(1,2) ${marker}"`);
    expect(exported.body).toContain(`"'+export details ${marker}"`);

    const contentDenied = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/operations/requests/export?limit=25`,
      headers: { cookie: content.cookie },
    });
    expect(contentDenied.statusCode).toBe(403);

    const viewerDenied = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/operations/requests/export?limit=25`,
      headers: { cookie: viewer.cookie },
    });
    expect(viewerDenied.statusCode).toBe(403);
  });

  it('caps large exports with explicit truncation headers', async () => {
    const owner = await login('owner@aurora.test');
    const property = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-city-hotel',
    );
    const locationId = await firstLocation(property.id);
    const marker = crypto.randomUUID();
    const baseMs = Date.now() + 11 * 24 * 60 * 60 * 1000;
    for (let index = 0; index < 3; index += 1) {
      await insertRequestFixture({
        organizationId: owner.body.activeOrganizationId,
        propertyId: property.id,
        locationId,
        marker: `${marker}-${index}`,
        title: `Bulk export ${marker} ${index}`,
        details: `Bulk details ${index}`,
        submittedAt: isoPlus(baseMs, index * 60_000),
      });
    }

    const exported = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/operations/requests/export?dateFrom=${encodeURIComponent(isoPlus(baseMs, 0))}&dateTo=${encodeURIComponent(isoPlus(baseMs, 10 * 60_000))}&limit=2`,
      headers: { cookie: owner.cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['x-export-row-count']).toBe('2');
    expect(exported.headers['x-export-truncated']).toBe('true');
    expect(exported.body.trim().split('\n')).toHaveLength(3);

    const tooLarge = await app.inject({
      method: 'GET',
      url: `/v1/admin/properties/${property.id}/operations/requests/export?limit=5001`,
      headers: { cookie: owner.cookie },
    });
    expect(tooLarge.statusCode).toBe(400);
  });

  it('filters immutable audit logs by tenant scope and redacts sensitive metadata', async () => {
    const owner = await login('owner@aurora.test');
    const manager = await login('manager.hotel@aurora.test');
    const content = await login('content@aurora.test');
    const hotel = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-city-hotel',
    );
    const cruise = await propertyBySlug(
      owner.cookie,
      owner.body.activeOrganizationId,
      'aurora-bay-cruise',
    );
    const hotelMarker = `audit-hotel-${crypto.randomUUID()}`;
    const cruiseMarker = `audit-cruise-${crypto.randomUUID()}`;
    await app.db.insert(auditLogs).values([
      {
        organizationId: owner.body.activeOrganizationId,
        actorUserId: null,
        action: 'request.status_changed',
        resourceType: 'request',
        resourceId: crypto.randomUUID(),
        metadata: {
          propertyId: hotel.id,
          marker: hotelMarker,
          publicNote: 'visible',
          token: 'raw-token-value',
          nested: { passwordHash: 'raw-hash-value' },
        },
      },
      {
        organizationId: owner.body.activeOrganizationId,
        actorUserId: null,
        action: 'order.status_changed',
        resourceType: 'order',
        resourceId: crypto.randomUUID(),
        metadata: { propertyId: cruise.id, marker: cruiseMarker },
      },
    ]);

    const ownerFiltered = await app.inject({
      method: 'GET',
      url: `/v1/admin/organizations/${owner.body.activeOrganizationId}/audit-logs?propertyId=${hotel.id}&resourceType=request&q=${hotelMarker}`,
      headers: { cookie: owner.cookie },
    });
    expect(ownerFiltered.statusCode).toBe(200);
    const ownerBody = ownerFiltered.json() as {
      entries: Array<{ metadata: Record<string, unknown> }>;
    };
    expect(ownerBody.entries).toHaveLength(1);
    expect(ownerBody.entries[0]?.metadata).toMatchObject({
      marker: hotelMarker,
      token: '[REDACTED]',
      nested: { passwordHash: '[REDACTED]' },
    });

    const managerList = await app.inject({
      method: 'GET',
      url: `/v1/admin/organizations/${manager.body.activeOrganizationId}/audit-logs?q=audit-`,
      headers: { cookie: manager.cookie },
    });
    expect(managerList.statusCode).toBe(200);
    const managerBody = managerList.json() as {
      entries: Array<{ metadata: { marker?: string } }>;
    };
    expect(managerBody.entries.some((entry) => entry.metadata.marker === hotelMarker)).toBe(true);
    expect(managerBody.entries.some((entry) => entry.metadata.marker === cruiseMarker)).toBe(false);

    const contentDenied = await app.inject({
      method: 'GET',
      url: `/v1/admin/organizations/${content.body.activeOrganizationId}/audit-logs`,
      headers: { cookie: content.cookie },
    });
    expect(contentDenied.statusCode).toBe(403);

    const immutable = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/organizations/${owner.body.activeOrganizationId}/audit-logs`,
      headers: { cookie: owner.cookie },
      payload: { entries: [] },
    });
    expect(immutable.statusCode).toBe(404);
  });
});
