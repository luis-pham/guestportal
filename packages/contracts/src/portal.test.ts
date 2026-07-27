import { describe, expect, it } from 'vitest';
import {
  createDefaultPortalConfig,
  portalConfigDocumentSchema,
  portalDraftUpdateSchema,
  plainTextSchema,
} from './portal.js';
import { PORTAL_TEMPLATE_SEEDS, templateForPropertyType } from './portal-templates.js';

describe('portalConfigDocumentSchema', () => {
  it('accepts default and template configs', () => {
    expect(portalConfigDocumentSchema.parse(createDefaultPortalConfig()).schemaVersion).toBe(1);
    for (const template of PORTAL_TEMPLATE_SEEDS) {
      expect(portalConfigDocumentSchema.parse(template.config).templateId).toBe(template.id);
    }
  });

  it('rejects free-form HTML in text fields', () => {
    const config = createDefaultPortalConfig();
    config.greeting.en = '<script>alert(1)</script>';
    expect(() => portalConfigDocumentSchema.parse(config)).toThrow(/HTML/);
    expect(() => plainTextSchema.parse('<b>bold</b>')).toThrow(/HTML/);
  });

  it('is forward-compatible on schemaVersion literal and draft update shape', () => {
    const config = createDefaultPortalConfig();
    const parsed = portalDraftUpdateSchema.parse({ version: 1, config });
    expect(parsed.version).toBe(1);
    expect(parsed.config.sections.length).toBeGreaterThan(0);
  });

  it('maps property types to templates', () => {
    expect(templateForPropertyType('airbnb').id).toBe('airbnb_default');
    expect(templateForPropertyType('unknown').id).toBe('hotel_default');
  });
});
