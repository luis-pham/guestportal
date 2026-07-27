import { describe, expect, it } from 'vitest';
import {
  AiToolError,
  createAiToolGateway,
  createGuestAiToolDefinitions,
} from './index.js';

const scope = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  propertyId: '22222222-2222-4222-8222-222222222222',
  guestSessionId: '33333333-3333-4333-8333-333333333333',
  conversationId: '44444444-4444-4444-8444-444444444444',
  locale: 'vi',
};

function handlers() {
  return {
    searchKnowledge: (input: { query: string }, toolScope: typeof scope) => ({
      query: input.query,
      sanitizedQuery: input.query,
      blocked: false,
      hits: [],
      citations: [],
      noResult: true,
      scopeEcho: toolScope.propertyId,
    }),
    readCatalog: (_input: unknown, toolScope: typeof scope) => ({
      propertyId: toolScope.propertyId,
      locale: toolScope.locale,
      items: [],
      noResult: true,
    }),
    readServices: (_input: unknown, toolScope: typeof scope) => ({
      propertyId: toolScope.propertyId,
      locale: toolScope.locale,
      services: [],
      noResult: true,
    }),
    draftRequest: (_input: unknown, toolScope: typeof scope) => ({
      draft: {
        id: '55555555-5555-4555-8555-555555555555',
        conversationId: toolScope.conversationId,
        status: 'draft',
        requestType: 'other',
        title: 'Extra towels',
        details: '',
        locale: toolScope.locale,
        metadata: {},
        expiresAt: '2026-07-27T14:00:00.000Z',
        confirmedRequestId: null,
        createdAt: '2026-07-27T13:45:00.000Z',
        updatedAt: '2026-07-27T13:45:00.000Z',
      },
    }),
    draftOrder: (_input: unknown, toolScope: typeof scope) => ({
      draft: {
        id: '66666666-6666-4666-8666-666666666666',
        conversationId: toolScope.conversationId,
        status: 'draft',
        title: 'Coffee',
        items: [{ itemId: 'coffee', label: 'Coffee', quantity: 1, notes: '', metadata: {} }],
        locale: toolScope.locale,
        notes: '',
        metadata: {},
        expiresAt: '2026-07-27T14:00:00.000Z',
        confirmedOrderId: null,
        createdAt: '2026-07-27T13:45:00.000Z',
        updatedAt: '2026-07-27T13:45:00.000Z',
      },
    }),
  } satisfies Parameters<typeof createGuestAiToolDefinitions>[0];
}

describe('ai tool gateway', () => {
  it('validates input and output around a registered tool', async () => {
    const gateway = createAiToolGateway(createGuestAiToolDefinitions(handlers()));

    const result = await gateway.execute({
      toolName: 'knowledge.search',
      input: { query: 'pool hours' },
      scope,
    });
    expect(result.noResult).toBe(true);
    expect(result).not.toHaveProperty('scopeEcho');
  });

  it('rejects unauthorized tools', async () => {
    const gateway = createAiToolGateway({});
    await expect(
      gateway.execute({
        toolName: 'knowledge.search',
        input: { query: 'pool hours' },
        scope,
      }),
    ).rejects.toMatchObject({
      code: 'AI_TOOL_UNAUTHORIZED',
      statusCode: 403,
    });
  });

  it('passes tenant scope to handlers and rejects invalid scope', async () => {
    let observedPropertyId = '';
    const gateway = createAiToolGateway(
      createGuestAiToolDefinitions({
        ...handlers(),
        readCatalog: (_input, toolScope) => {
          observedPropertyId = toolScope.propertyId;
          return {
            propertyId: toolScope.propertyId,
            locale: toolScope.locale,
            items: [],
            noResult: true,
          };
        },
      }),
    );

    await gateway.execute({ toolName: 'catalog.read', input: {}, scope });
    expect(observedPropertyId).toBe(scope.propertyId);

    await expect(
      gateway.execute({
        toolName: 'catalog.read',
        input: {},
        scope: { ...scope, propertyId: 'not-a-uuid' },
      }),
    ).rejects.toBeInstanceOf(AiToolError);
  });

  it('fails closed on malformed tool output', async () => {
    const gateway = createAiToolGateway(
      createGuestAiToolDefinitions({
        ...handlers(),
        searchKnowledge: () => ({ malformed: true }),
      }),
    );

    await expect(
      gateway.execute({
        toolName: 'knowledge.search',
        input: { query: 'pool hours' },
        scope,
      }),
    ).rejects.toMatchObject({
      code: 'AI_TOOL_OUTPUT_INVALID',
      statusCode: 502,
    });
  });

  it('allows draft tools but not direct confirmation tools', async () => {
    const gateway = createAiToolGateway(createGuestAiToolDefinitions(handlers()));
    const result = await gateway.execute({
      toolName: 'request.draft',
      input: { title: 'Extra towels' },
      scope,
    });
    expect(result.draft.status).toBe('draft');

    await expect(
      gateway.execute({
        toolName: 'request.confirm' as never,
        input: {},
        scope,
      }),
    ).rejects.toMatchObject({
      code: 'AI_TOOL_UNAUTHORIZED',
      statusCode: 403,
    });
  });
});
