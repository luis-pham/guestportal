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

describe('ai tool gateway', () => {
  it('validates input and output around a registered tool', async () => {
    const gateway = createAiToolGateway(
      createGuestAiToolDefinitions({
        searchKnowledge: (input, toolScope) => ({
          query: input.query,
          sanitizedQuery: input.query,
          blocked: false,
          hits: [],
          citations: [],
          noResult: true,
          scopeEcho: toolScope.propertyId,
        }),
        readCatalog: (_input, toolScope) => ({
          propertyId: toolScope.propertyId,
          locale: toolScope.locale,
          items: [],
          noResult: true,
        }),
        readServices: (_input, toolScope) => ({
          propertyId: toolScope.propertyId,
          locale: toolScope.locale,
          services: [],
          noResult: true,
        }),
      }),
    );

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
        searchKnowledge: () => ({
          query: 'unused',
          sanitizedQuery: 'unused',
          blocked: false,
          hits: [],
          citations: [],
          noResult: true,
        }),
        readCatalog: (_input, toolScope) => {
          observedPropertyId = toolScope.propertyId;
          return {
            propertyId: toolScope.propertyId,
            locale: toolScope.locale,
            items: [],
            noResult: true,
          };
        },
        readServices: (_input, toolScope) => ({
          propertyId: toolScope.propertyId,
          locale: toolScope.locale,
          services: [],
          noResult: true,
        }),
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
        searchKnowledge: () => ({ malformed: true }),
        readCatalog: (_input, toolScope) => ({
          propertyId: toolScope.propertyId,
          locale: toolScope.locale,
          items: [],
          noResult: true,
        }),
        readServices: (_input, toolScope) => ({
          propertyId: toolScope.propertyId,
          locale: toolScope.locale,
          services: [],
          noResult: true,
        }),
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
});
