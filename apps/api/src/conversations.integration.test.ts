import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { hashEmbedText, toPgVectorLiteral } from '@guestportal/rag';
import { buildApp } from './app.js';
import { resetRateLimits } from './services/rate-limit.js';
import { GUEST_SESSION_COOKIE } from './services/guest-sessions.js';

const databaseUrl = process.env.DATABASE_URL;
const cookieSecret = process.env.AUTH_COOKIE_SECRET ?? 'abcdefghijklmnopqrstuvwxyz012345';
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('guest conversations', () => {
  let app: FastifyInstance;
  const knowledgeSourceIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp({ databaseUrl: databaseUrl!, cookieSecret });
  });

  afterAll(async () => {
    for (const sourceId of knowledgeSourceIds) {
      await app.sql`DELETE FROM knowledge_chunks WHERE source_id = ${sourceId}::uuid`;
      await app.sql`DELETE FROM knowledge_sources WHERE id = ${sourceId}::uuid`;
    }
    await app.close();
  });

  beforeEach(() => {
    resetRateLimits();
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
      adminCookie: owner.cookie,
      organizationId: owner.body.activeOrganizationId,
      propertyId: qr.propertyId,
      guestCookie: `${GUEST_SESSION_COOKIE}=${guestCookie!.value}`,
    };
  }

  async function createGuestCookie(email = 'owner@aurora.test') {
    return (await createGuestContext(email)).guestCookie;
  }

  async function createConversation(cookie: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/guest/conversations',
      headers: { cookie },
      payload: { locale: 'vi', retentionPolicy: 'standard_30_days' },
    });
    expect(response.statusCode).toBe(200);
    return response.json() as { conversation: { id: string; retentionExpiresAt: string } };
  }

  it('persists guest messages in stable conversation order and deduplicates retry ids', async () => {
    const cookie = await createGuestCookie();
    const { conversation } = await createConversation(cookie);

    const first = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/messages`,
      headers: { cookie },
      payload: {
        text: '  Xin chào, hồ bơi mở đến mấy giờ?  ',
        originalLanguage: 'vi',
        clientMessageId: 'retry-1',
      },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().message.sequence).toBe(1);
    expect(first.json().message.originalText).toBe('Xin chào, hồ bơi mở đến mấy giờ?');

    const duplicate = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/messages`,
      headers: { cookie },
      payload: { text: 'Network retry should not create a new row', clientMessageId: 'retry-1' },
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().message.id).toBe(first.json().message.id);
    expect(duplicate.json().message.sequence).toBe(1);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/messages`,
      headers: { cookie },
      payload: { text: 'Can I get towels?', originalLanguage: 'en', clientMessageId: 'retry-2' },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().message.sequence).toBe(2);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/guest/conversations/${conversation.id}`,
      headers: { cookie },
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json() as {
      conversation: { lastMessageSequence: number };
      messages: Array<{ sequence: number; originalText: string }>;
    };
    expect(body.conversation.lastMessageSequence).toBe(2);
    expect(body.messages.map((message) => message.sequence)).toEqual([1, 2]);
    expect(body.messages.map((message) => message.originalText)).toEqual([
      'Xin chào, hồ bơi mở đến mấy giờ?',
      'Can I get towels?',
    ]);
  });

  it('isolates conversations by guest session and tenant scope', async () => {
    const auroraCookie = await createGuestCookie('owner@aurora.test');
    const otherAuroraCookie = await createGuestCookie('owner@aurora.test');
    const nomadCookie = await createGuestCookie('owner@nomad.test');
    const { conversation } = await createConversation(auroraCookie);

    const samePropertyDifferentSession = await app.inject({
      method: 'GET',
      url: `/v1/guest/conversations/${conversation.id}`,
      headers: { cookie: otherAuroraCookie },
    });
    expect(samePropertyDifferentSession.statusCode).toBe(404);

    const foreignTenant = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/messages`,
      headers: { cookie: nomadCookie },
      payload: { text: 'Cross-tenant write attempt' },
    });
    expect(foreignTenant.statusCode).toBe(404);
  });

  it('enforces explicit transcript retention expiry', async () => {
    const cookie = await createGuestCookie();
    const { conversation } = await createConversation(cookie);
    expect(Date.parse(conversation.retentionExpiresAt)).toBeGreaterThan(Date.now());

    await app.sql`
      UPDATE conversations
      SET retention_expires_at = now() - interval '1 second'
      WHERE id = ${conversation.id}::uuid
    `;

    const expired = await app.inject({
      method: 'GET',
      url: `/v1/guest/conversations/${conversation.id}`,
      headers: { cookie },
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json().error.code).toBe('CONVERSATION_EXPIRED');
  });

  it('executes scoped read-only AI tools and persists validated tool output', async () => {
    const context = await createGuestContext();
    const { conversation } = await createConversation(context.guestCookie);
    const sourceId = randomUUID();
    const chunkId = randomUUID();
    const content = 'Spa towels are available from the front desk. Khăn spa có tại lễ tân.';
    knowledgeSourceIds.push(sourceId);
    await app.sql`
      INSERT INTO knowledge_sources (
        id, organization_id, property_id, type, title, source_language, version, status
      ) VALUES (
        ${sourceId}::uuid, ${context.organizationId}::uuid, ${context.propertyId}::uuid,
        'manual', 'Spa Guide', 'en', 1, 'ready'
      )
    `;
    await app.sql`
      INSERT INTO knowledge_chunks (
        id, organization_id, property_id, source_id, ordinal, content, heading_path,
        source_language, content_hash, metadata, embedding, active, version
      ) VALUES (
        ${chunkId}::uuid, ${context.organizationId}::uuid, ${context.propertyId}::uuid,
        ${sourceId}::uuid, 0, ${content}, ${JSON.stringify(['Spa'])}::jsonb, 'en',
        ${'hash-spa-tools'}, ${JSON.stringify({ fixture: true })}::jsonb,
        ${toPgVectorLiteral(hashEmbedText(content))}::vector, true, 1
      )
    `;

    const response = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      headers: { cookie: context.guestCookie },
      payload: {
        toolName: 'knowledge.search',
        input: { query: 'spa towels', limit: 5 },
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      result: { citations: Array<{ sourceId: string }>; noResult: boolean };
    };
    expect(body.result.noResult).toBe(false);
    expect(body.result.citations.some((citation) => citation.sourceId === sourceId)).toBe(true);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/guest/conversations/${conversation.id}`,
      headers: { cookie: context.guestCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(
      (detail.json() as { messages: Array<{ role: string; toolName: string | null }> }).messages
        .some((message) => message.role === 'tool' && message.toolName === 'knowledge.search'),
    ).toBe(true);
  });

  it('validates AI tool input and denies unscoped tool calls', async () => {
    const cookie = await createGuestCookie();
    const otherCookie = await createGuestCookie();
    const { conversation } = await createConversation(cookie);

    const missingSession = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      payload: { toolName: 'catalog.read', input: {} },
    });
    expect(missingSession.statusCode).toBe(401);

    const crossSession = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      headers: { cookie: otherCookie },
      payload: { toolName: 'catalog.read', input: {} },
    });
    expect(crossSession.statusCode).toBe(404);

    const malformed = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      headers: { cookie },
      payload: { toolName: 'knowledge.search', input: { query: 'pool', limit: 99 } },
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('AI_TOOL_INPUT_INVALID');
  });

  it('reads catalog tool output only from the scoped published portal', async () => {
    const context = await createGuestContext();
    const draft = await app.inject({
      method: 'GET',
      url: `/v1/properties/${context.propertyId}/portal/draft`,
      headers: { cookie: context.adminCookie },
    });
    expect(draft.statusCode).toBe(200);
    const publish = await app.inject({
      method: 'POST',
      url: `/v1/properties/${context.propertyId}/portal/publish`,
      headers: { cookie: context.adminCookie },
      payload: { expectedDraftVersion: draft.json().version },
    });
    expect(publish.statusCode).toBe(200);

    const { conversation } = await createConversation(context.guestCookie);
    const response = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      headers: { cookie: context.guestCookie },
      payload: { toolName: 'catalog.read', input: { locale: 'vi', limit: 20 } },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      result: { propertyId: string; items: Array<{ type: string }> };
    };
    expect(body.result.propertyId).toBe(context.propertyId);
    expect(body.result).not.toHaveProperty('organizationId');
    expect(body.result.items.length).toBeGreaterThan(0);
  });

  it('requires explicit idempotent guest confirmation for request drafts', async () => {
    const context = await createGuestContext();
    const { conversation } = await createConversation(context.guestCookie);
    const draftResponse = await app.inject({
      method: 'POST',
      url: '/v1/guest/request-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId: conversation.id,
        requestType: 'housekeeping',
        title: 'Extra towels',
        details: 'Please bring two towels.',
        locale: 'vi',
      },
    });
    expect(draftResponse.statusCode).toBe(200);
    const draftId = draftResponse.json().draft.id as string;

    const confirmPayload = { idempotencyKey: `request-confirm-${draftId}` };
    const firstConfirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/request-drafts/${draftId}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: confirmPayload,
    });
    expect(firstConfirm.statusCode).toBe(200);
    expect(firstConfirm.json().idempotentReplay).toBe(false);
    const requestId = firstConfirm.json().request.id as string;

    const duplicateConfirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/request-drafts/${draftId}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: confirmPayload,
    });
    expect(duplicateConfirm.statusCode).toBe(200);
    expect(duplicateConfirm.json().idempotentReplay).toBe(true);
    expect(duplicateConfirm.json().request.id).toBe(requestId);

    const requestRows = await app.sql<{ count: string }[]>`
      SELECT count(*)::text
      FROM guest_requests
      WHERE request_draft_id = ${draftId}::uuid
    `;
    expect(requestRows[0]?.count).toBe('1');
    const outboxRows = await app.sql<{ count: string }[]>`
      SELECT count(*)::text
      FROM outbox_events
      WHERE aggregate_id = ${requestId}
        AND event_type = 'request.submitted.v1'
    `;
    expect(outboxRows[0]?.count).toBe('1');

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/guest/conversations/${conversation.id}`,
      headers: { cookie: context.guestCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(
      (detail.json() as { messages: Array<{ requestId: string | null }> }).messages.some(
        (message) => message.requestId === requestId,
      ),
    ).toBe(true);
  });

  it('rejects expired drafts without committing a request', async () => {
    const context = await createGuestContext();
    const { conversation } = await createConversation(context.guestCookie);
    const draftResponse = await app.inject({
      method: 'POST',
      url: '/v1/guest/request-drafts',
      headers: { cookie: context.guestCookie },
      payload: {
        conversationId: conversation.id,
        title: 'Late checkout',
        details: 'Can I check out at 2pm?',
      },
    });
    expect(draftResponse.statusCode).toBe(200);
    const draftId = draftResponse.json().draft.id as string;

    await app.sql`
      UPDATE request_drafts
      SET expires_at = now() - interval '1 second'
      WHERE id = ${draftId}::uuid
    `;
    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/request-drafts/${draftId}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `expired-${draftId}` },
    });
    expect(confirm.statusCode).toBe(410);
    expect(confirm.json().error.code).toBe('DRAFT_EXPIRED');

    const requestRows = await app.sql<{ count: string }[]>`
      SELECT count(*)::text
      FROM guest_requests
      WHERE request_draft_id = ${draftId}::uuid
    `;
    expect(requestRows[0]?.count).toBe('0');
  });

  it('denies unauthorized draft commits across guest sessions', async () => {
    const ownerCookie = await createGuestCookie();
    const otherCookie = await createGuestCookie();
    const { conversation } = await createConversation(ownerCookie);
    const draftResponse = await app.inject({
      method: 'POST',
      url: '/v1/guest/request-drafts',
      headers: { cookie: ownerCookie },
      payload: {
        conversationId: conversation.id,
        title: 'Room cleaning',
        details: 'Please clean the room.',
      },
    });
    expect(draftResponse.statusCode).toBe(200);

    const unauthorized = await app.inject({
      method: 'POST',
      url: `/v1/guest/request-drafts/${draftResponse.json().draft.id}/confirm`,
      headers: { cookie: otherCookie },
      payload: { idempotencyKey: 'unauthorized-confirm-1' },
    });
    expect(unauthorized.statusCode).toBe(404);
    expect(unauthorized.json().error.code).toBe('DRAFT_NOT_FOUND');
  });

  it('creates order drafts through AI tools and commits only after guest confirmation', async () => {
    const context = await createGuestContext();
    const { conversation } = await createConversation(context.guestCookie);
    const toolDraft = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      headers: { cookie: context.guestCookie },
      payload: {
        toolName: 'order.draft',
        input: {
          title: 'Coffee order',
          items: [{ itemId: 'coffee', label: 'Coffee', quantity: 2 }],
          notes: 'No sugar',
        },
      },
    });
    expect(toolDraft.statusCode).toBe(200);
    const draftId = toolDraft.json().result.draft.id as string;

    const blockedCommitTool = await app.inject({
      method: 'POST',
      url: `/v1/guest/conversations/${conversation.id}/tool-results`,
      headers: { cookie: context.guestCookie },
      payload: {
        toolName: 'order.confirm',
        input: { draftId },
      },
    });
    expect(blockedCommitTool.statusCode).toBe(400);
    expect(blockedCommitTool.json().error.code).toBe('VALIDATION_ERROR');

    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/guest/order-drafts/${draftId}/confirm`,
      headers: { cookie: context.guestCookie },
      payload: { idempotencyKey: `order-confirm-${draftId}` },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().idempotentReplay).toBe(false);
    const orderId = confirm.json().order.id as string;

    const transactionRows = await app.sql<{ outbox_count: string; message_count: string }[]>`
      SELECT
        (
          SELECT count(*)::text
          FROM outbox_events
          WHERE aggregate_id = ${orderId}
            AND event_type = 'order.submitted.v1'
        ) AS outbox_count,
        (
          SELECT count(*)::text
          FROM messages
          WHERE conversation_id = ${conversation.id}::uuid
            AND order_id = ${orderId}::uuid
        ) AS message_count
    `;
    expect(transactionRows[0]).toEqual({ outbox_count: '1', message_count: '1' });
  });
});
