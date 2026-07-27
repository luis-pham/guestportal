import { z } from 'zod';

export const plainTextSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => !/<\/?[a-z][\s\S]*>/i.test(value), {
    message: 'HTML markup is not allowed',
  });

export const localizedPlainTextSchema = z.object({
  vi: plainTextSchema.default(''),
  en: plainTextSchema.default(''),
});

export const portalSchemaVersionSchema = z.literal(1);

export const portalSectionTypeSchema = z.enum([
  'hero',
  'quick_actions',
  'explore_collections',
  'featured_services',
  'schedule',
  'guide_links',
  'promotion_banner',
  'assistant_callout',
  'contact_help',
]);

const sectionBase = {
  id: z.string().uuid(),
  enabled: z.boolean().default(true),
};

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('hero'),
  title: localizedPlainTextSchema,
  subtitle: localizedPlainTextSchema,
  ctaLabel: localizedPlainTextSchema.optional(),
  ctaHref: z
    .string()
    .trim()
    .max(500)
    .regex(/^(https?:\/\/|\/|#)/, 'CTA must be http(s), absolute path, or hash')
    .optional()
    .nullable(),
});

export const quickActionsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('quick_actions'),
  title: localizedPlainTextSchema.optional(),
  actions: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: localizedPlainTextSchema,
        href: z.string().trim().min(1).max(500),
        icon: z.enum(['bell', 'food', 'map', 'chat', 'info', 'custom']).default('info'),
      }),
    )
    .max(8)
    .default([]),
});

export const exploreCollectionsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('explore_collections'),
  title: localizedPlainTextSchema,
  collectionKeys: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
});

export const featuredServicesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('featured_services'),
  title: localizedPlainTextSchema,
  serviceIds: z.array(z.string().uuid()).max(12).default([]),
});

export const scheduleSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('schedule'),
  title: localizedPlainTextSchema,
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: localizedPlainTextSchema,
        timeLabel: localizedPlainTextSchema,
      }),
    )
    .max(20)
    .default([]),
});

export const guideLinksSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('guide_links'),
  title: localizedPlainTextSchema,
  links: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: localizedPlainTextSchema,
        href: z.string().trim().min(1).max(500),
      }),
    )
    .max(20)
    .default([]),
});

export const promotionBannerSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('promotion_banner'),
  title: localizedPlainTextSchema,
  body: localizedPlainTextSchema,
  href: z.string().trim().max(500).optional().nullable(),
});

export const assistantCalloutSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('assistant_callout'),
  title: localizedPlainTextSchema,
  body: localizedPlainTextSchema,
});

export const contactHelpSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('contact_help'),
  title: localizedPlainTextSchema,
  body: localizedPlainTextSchema,
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.union([z.string().email().max(120), z.literal('')]).optional().nullable(),
});

export const portalSectionSchema = z.discriminatedUnion('type', [
  heroSectionSchema,
  quickActionsSectionSchema,
  exploreCollectionsSectionSchema,
  featuredServicesSectionSchema,
  scheduleSectionSchema,
  guideLinksSectionSchema,
  promotionBannerSectionSchema,
  assistantCalloutSectionSchema,
  contactHelpSectionSchema,
]);

export const portalNavItemSchema = z.object({
  id: z.string().uuid(),
  label: localizedPlainTextSchema,
  href: z.string().trim().min(1).max(500),
  visible: z.boolean().default(true),
});

export const portalConfigDocumentSchema = z
  .object({
    schemaVersion: portalSchemaVersionSchema,
    templateId: z.string().trim().min(1).max(64).optional(),
    greeting: localizedPlainTextSchema,
    assistant: z.object({
      name: localizedPlainTextSchema,
      avatarAssetId: z.string().uuid().nullable().default(null),
    }),
    primaryNavigation: z.array(portalNavItemSchema).max(12).default([]),
    secondaryNavigation: z.array(portalNavItemSchema).max(12).default([]),
    sections: z.array(portalSectionSchema).max(40).default([]),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const section of doc.sections) {
      if (ids.has(section.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate section id: ${section.id}`,
          path: ['sections'],
        });
      }
      ids.add(section.id);
    }
  });

export const portalDraftResponseSchema = z.object({
  propertyId: z.string().uuid(),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  config: portalConfigDocumentSchema,
});

export const portalDraftUpdateSchema = z.object({
  version: z.number().int().positive(),
  config: portalConfigDocumentSchema,
});

export const portalValidateRequestSchema = z.object({
  config: portalConfigDocumentSchema,
});

export type LocalizedPlainText = z.infer<typeof localizedPlainTextSchema>;
export type PortalSectionType = z.infer<typeof portalSectionTypeSchema>;
export type PortalSection = z.infer<typeof portalSectionSchema>;
export type PortalConfigDocument = z.infer<typeof portalConfigDocumentSchema>;
export type PortalDraftUpdateInput = z.infer<typeof portalDraftUpdateSchema>;

export function emptyLocalized(vi = '', en = ''): LocalizedPlainText {
  return { vi, en };
}

export function createEmptySection(type: PortalSectionType): PortalSection {
  const id = crypto.randomUUID();
  switch (type) {
    case 'hero':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('New hero', 'New hero'),
        subtitle: emptyLocalized('', ''),
        ctaLabel: emptyLocalized('Learn more', 'Learn more'),
        ctaHref: '/',
      };
    case 'quick_actions':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Quick actions', 'Quick actions'),
        actions: [],
      };
    case 'explore_collections':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Explore', 'Explore'),
        collectionKeys: [],
      };
    case 'featured_services':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Featured', 'Featured'),
        serviceIds: [],
      };
    case 'schedule':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Schedule', 'Schedule'),
        items: [],
      };
    case 'guide_links':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Guides', 'Guides'),
        links: [],
      };
    case 'promotion_banner':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Offer', 'Offer'),
        body: emptyLocalized('', ''),
        href: null,
      };
    case 'assistant_callout':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Assistant', 'Assistant'),
        body: emptyLocalized('', ''),
      };
    case 'contact_help':
      return {
        id,
        type,
        enabled: true,
        title: emptyLocalized('Contact', 'Contact'),
        body: emptyLocalized('', ''),
        phone: null,
        email: '',
      };
  }
}

export function createDefaultPortalConfig(templateId = 'hotel_default'): PortalConfigDocument {
  const heroId = crypto.randomUUID();
  const quickId = crypto.randomUUID();
  const contactId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  const exploreId = crypto.randomUUID();
  const guideId = crypto.randomUUID();
  return {
    schemaVersion: 1,
    templateId,
    greeting: emptyLocalized('Xin chào', 'Welcome'),
    assistant: {
      name: emptyLocalized('Trợ lý', 'Assistant'),
      avatarAssetId: null,
    },
    primaryNavigation: [
      {
        id: crypto.randomUUID(),
        label: emptyLocalized('Trang chủ', 'Home'),
        href: '/',
        visible: true,
      },
      {
        id: crypto.randomUUID(),
        label: emptyLocalized('Khám phá', 'Explore'),
        href: '/explore',
        visible: true,
      },
      {
        id: crypto.randomUUID(),
        label: emptyLocalized('Hướng dẫn', 'Guide'),
        href: '/guide',
        visible: true,
      },
      {
        id: crypto.randomUUID(),
        label: emptyLocalized('Trợ lý', 'Assistant'),
        href: '/chat',
        visible: true,
      },
    ],
    secondaryNavigation: [],
    sections: [
      {
        id: heroId,
        type: 'hero',
        enabled: true,
        title: emptyLocalized('Chào mừng đến khách sạn', 'Welcome to the hotel'),
        subtitle: emptyLocalized('Khám phá dịch vụ dành cho bạn', 'Explore services for your stay'),
        ctaLabel: emptyLocalized('Bắt đầu', 'Get started'),
        ctaHref: '#assistant',
      },
      {
        id: quickId,
        type: 'quick_actions',
        enabled: true,
        title: emptyLocalized('Thao tác nhanh', 'Quick actions'),
        actions: [
          {
            id: crypto.randomUUID(),
            label: emptyLocalized('Gọi hỗ trợ', 'Call support'),
            href: '/help',
            icon: 'bell',
          },
          {
            id: crypto.randomUUID(),
            label: emptyLocalized('Đặt đồ ăn', 'Order food'),
            href: '/food',
            icon: 'food',
          },
        ],
      },
      {
        id: exploreId,
        type: 'explore_collections',
        enabled: true,
        title: emptyLocalized('Khám phá', 'Explore'),
        collectionKeys: ['amenities', 'dining', 'experiences'],
      },
      {
        id: guideId,
        type: 'guide_links',
        enabled: true,
        title: emptyLocalized('Hướng dẫn', 'Guide'),
        links: [
          {
            id: crypto.randomUUID(),
            label: emptyLocalized('Wi‑Fi', 'Wi‑Fi'),
            href: '/guide/wifi',
          },
          {
            id: crypto.randomUUID(),
            label: emptyLocalized('Check-out', 'Check-out'),
            href: '/guide/checkout',
          },
        ],
      },
      {
        id: assistantId,
        type: 'assistant_callout',
        enabled: true,
        title: emptyLocalized('Hỏi trợ lý', 'Ask the assistant'),
        body: emptyLocalized(
          'Đặt câu hỏi về chỗ ở, dịch vụ và lịch trình.',
          'Ask about your stay, services, and schedule.',
        ),
      },
      {
        id: contactId,
        type: 'contact_help',
        enabled: true,
        title: emptyLocalized('Liên hệ', 'Contact'),
        body: emptyLocalized('Chúng tôi luôn sẵn sàng hỗ trợ.', 'We are here to help.'),
        phone: null,
        email: '',
      },
    ],
  };
}
