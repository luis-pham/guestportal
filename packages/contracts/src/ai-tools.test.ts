import { describe, expect, it } from 'vitest';
import {
  catalogReadToolOutputSchema,
  guestAiToolExecuteRequestSchema,
  knowledgeSearchToolInputSchema,
  serviceReadToolOutputSchema,
} from './ai-tools.js';

describe('ai tool contracts', () => {
  it('validates bounded knowledge search input', () => {
    const parsed = knowledgeSearchToolInputSchema.parse({
      query: 'pool hours',
    });
    expect(parsed.limit).toBe(5);
    expect(() => knowledgeSearchToolInputSchema.parse({ query: '' })).toThrow();
    expect(() => knowledgeSearchToolInputSchema.parse({ query: 'pool', limit: 20 })).toThrow();
  });

  it('rejects unknown tool execution requests', () => {
    expect(() =>
      guestAiToolExecuteRequestSchema.parse({
        toolName: 'request.create',
        input: {},
      }),
    ).toThrow();
  });

  it('validates catalog and service read outputs', () => {
    const item = {
      id: 'guide-1',
      type: 'guide',
      label: { vi: 'Hồ bơi', en: 'Pool' },
      body: null,
      href: '#pool',
      metadata: {},
    };
    expect(
      catalogReadToolOutputSchema.parse({
        propertyId: '11111111-1111-4111-8111-111111111111',
        locale: 'vi',
        items: [item],
        noResult: false,
      }).items,
    ).toHaveLength(1);
    expect(
      serviceReadToolOutputSchema.parse({
        propertyId: '11111111-1111-4111-8111-111111111111',
        locale: 'en',
        services: [{ ...item, type: 'service' }],
        noResult: false,
      }).services[0]?.type,
    ).toBe('service');
  });
});
