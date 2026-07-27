import { z } from 'zod';

export const guestWorkItemKindSchema = z.enum(['request', 'order']);
export const guestDraftStatusSchema = z.enum(['draft', 'confirmed', 'expired', 'cancelled']);
export const guestSubmittedStatusSchema = z.enum(['submitted', 'cancelled']);

export const requestDraftPayloadSchema = z.object({
  requestType: z.enum(['service', 'housekeeping', 'maintenance', 'amenity', 'other']).default('other'),
  title: z.string().trim().min(1).max(120),
  details: z.string().trim().max(2000).default(''),
  locale: z.string().trim().min(2).max(16).default('en'),
  metadata: z.record(z.unknown()).default({}),
});

export const orderDraftItemSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().trim().max(500).default(''),
  metadata: z.record(z.unknown()).default({}),
});

export const orderDraftPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  items: z.array(orderDraftItemSchema).min(1).max(25),
  locale: z.string().trim().min(2).max(16).default('en'),
  notes: z.string().trim().max(2000).default(''),
  metadata: z.record(z.unknown()).default({}),
});

export const guestRequestDraftCreateRequestSchema = requestDraftPayloadSchema.extend({
  conversationId: z.string().uuid(),
});

export const guestOrderDraftCreateRequestSchema = orderDraftPayloadSchema.extend({
  conversationId: z.string().uuid(),
});

export const guestDraftConfirmRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const guestRequestDraftSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: guestDraftStatusSchema,
  requestType: requestDraftPayloadSchema.shape.requestType,
  title: z.string(),
  details: z.string(),
  locale: z.string(),
  metadata: z.record(z.unknown()),
  expiresAt: z.string().datetime(),
  confirmedRequestId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const guestOrderDraftSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: guestDraftStatusSchema,
  title: z.string(),
  items: z.array(orderDraftItemSchema),
  locale: z.string(),
  notes: z.string(),
  metadata: z.record(z.unknown()),
  expiresAt: z.string().datetime(),
  confirmedOrderId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const guestRequestSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  draftId: z.string().uuid(),
  status: guestSubmittedStatusSchema,
  requestType: requestDraftPayloadSchema.shape.requestType,
  title: z.string(),
  details: z.string(),
  locale: z.string(),
  metadata: z.record(z.unknown()),
  submittedAt: z.string().datetime(),
});

export const guestOrderSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  draftId: z.string().uuid(),
  status: guestSubmittedStatusSchema,
  title: z.string(),
  items: z.array(orderDraftItemSchema),
  locale: z.string(),
  notes: z.string(),
  metadata: z.record(z.unknown()),
  submittedAt: z.string().datetime(),
});

export const guestRequestDraftCreateResponseSchema = z.object({
  draft: guestRequestDraftSchema,
});

export const guestOrderDraftCreateResponseSchema = z.object({
  draft: guestOrderDraftSchema,
});

export const guestRequestDraftConfirmResponseSchema = z.object({
  request: guestRequestSchema,
  idempotentReplay: z.boolean(),
});

export const guestOrderDraftConfirmResponseSchema = z.object({
  order: guestOrderSchema,
  idempotentReplay: z.boolean(),
});

export type GuestWorkItemKind = z.infer<typeof guestWorkItemKindSchema>;
export type GuestDraftStatus = z.infer<typeof guestDraftStatusSchema>;
export type GuestSubmittedStatus = z.infer<typeof guestSubmittedStatusSchema>;
export type RequestDraftPayload = z.infer<typeof requestDraftPayloadSchema>;
export type OrderDraftItem = z.infer<typeof orderDraftItemSchema>;
export type OrderDraftPayload = z.infer<typeof orderDraftPayloadSchema>;
export type GuestRequestDraftCreateRequest = z.infer<
  typeof guestRequestDraftCreateRequestSchema
>;
export type GuestOrderDraftCreateRequest = z.infer<typeof guestOrderDraftCreateRequestSchema>;
export type GuestDraftConfirmRequest = z.infer<typeof guestDraftConfirmRequestSchema>;
export type GuestRequestDraft = z.infer<typeof guestRequestDraftSchema>;
export type GuestOrderDraft = z.infer<typeof guestOrderDraftSchema>;
export type GuestRequest = z.infer<typeof guestRequestSchema>;
export type GuestOrder = z.infer<typeof guestOrderSchema>;
export type GuestRequestDraftCreateResponse = z.infer<
  typeof guestRequestDraftCreateResponseSchema
>;
export type GuestOrderDraftCreateResponse = z.infer<typeof guestOrderDraftCreateResponseSchema>;
export type GuestRequestDraftConfirmResponse = z.infer<
  typeof guestRequestDraftConfirmResponseSchema
>;
export type GuestOrderDraftConfirmResponse = z.infer<
  typeof guestOrderDraftConfirmResponseSchema
>;
