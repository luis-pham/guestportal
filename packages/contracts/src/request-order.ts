import { z } from 'zod';

export const guestWorkItemKindSchema = z.enum(['request', 'order']);
export const guestDraftStatusSchema = z.enum(['draft', 'confirmed', 'expired', 'cancelled']);
export const guestRequestStatusSchema = z.enum([
  'submitted',
  'accepted',
  'rejected',
  'cancelled',
  'in_progress',
  'completed',
]);
export const guestOrderStatusSchema = z.enum([
  'submitted',
  'confirmed',
  'cancelled',
  'preparing',
  'ready',
  'delivering',
  'completed',
]);
export const guestSubmittedStatusSchema = z.union([
  guestRequestStatusSchema,
  guestOrderStatusSchema,
]);

export const requestDraftPayloadSchema = z.object({
  requestType: z
    .enum(['service', 'housekeeping', 'maintenance', 'amenity', 'other'])
    .default('other'),
  title: z.string().trim().min(1).max(120),
  details: z.string().trim().max(2000).default(''),
  locale: z.string().trim().min(2).max(16).default('en'),
  metadata: z.record(z.unknown()).default({}),
});

export const orderDraftItemSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(99),
  unitPriceMinor: z.number().int().min(0).max(100_000_000).default(0),
  currency: z.string().trim().length(3).default('USD'),
  optionsSnapshot: z.record(z.unknown()).default({}),
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
  status: guestRequestStatusSchema,
  version: z.number().int().min(1),
  requestType: requestDraftPayloadSchema.shape.requestType,
  title: z.string(),
  details: z.string(),
  locale: z.string(),
  metadata: z.record(z.unknown()),
  assignedStaffId: z.string().uuid().nullable(),
  submittedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  inProgressAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const guestOrderSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  draftId: z.string().uuid(),
  status: guestOrderStatusSchema,
  version: z.number().int().min(1),
  title: z.string(),
  items: z.array(orderDraftItemSchema),
  currency: z.string().trim().length(3),
  subtotalMinor: z.number().int().min(0),
  totalMinor: z.number().int().min(0),
  locale: z.string(),
  notes: z.string(),
  metadata: z.record(z.unknown()),
  assignedStaffId: z.string().uuid().nullable(),
  submittedAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
  preparingAt: z.string().datetime().nullable(),
  readyAt: z.string().datetime().nullable(),
  deliveringAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const staffTransitionRequestSchema = z.object({
  expectedVersion: z.number().int().min(1).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const staffClaimRequestSchema = staffTransitionRequestSchema;

export const staffWorkLocationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.object({ vi: z.string(), en: z.string() }),
});

export const staffWorkAssigneeSchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string(),
  })
  .nullable();

export const staffWorkItemSummarySchema = z.object({
  kind: guestWorkItemKindSchema,
  id: z.string().uuid(),
  status: guestSubmittedStatusSchema,
  version: z.number().int().min(1),
  title: z.string(),
  summary: z.string(),
  locale: z.string(),
  conversationId: z.string().uuid(),
  location: staffWorkLocationSchema,
  assignee: staffWorkAssigneeSchema,
  submittedAt: z.string().datetime(),
  waitingSeconds: z.number().int().min(0),
  priority: z.literal('normal'),
  totalMinor: z.number().int().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
});

export const staffConversationMessageSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().min(1),
  role: z.string(),
  source: z.string(),
  originalLanguage: z.string().nullable(),
  originalText: z.string(),
  translatedText: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const staffTimelineItemSchema = z.object({
  id: z.string().uuid(),
  previousStatus: z.string().nullable(),
  nextStatus: z.string(),
  actorType: z.enum(['guest', 'staff', 'system']),
  actorId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  version: z.number().int().min(1),
  createdAt: z.string().datetime(),
});

export const staffRequestDetailSchema = z.object({
  kind: z.literal('request'),
  request: guestRequestSchema,
  location: staffWorkLocationSchema,
  assignee: staffWorkAssigneeSchema,
  messages: z.array(staffConversationMessageSchema),
  timeline: z.array(staffTimelineItemSchema),
});

export const staffOrderDetailSchema = z.object({
  kind: z.literal('order'),
  order: guestOrderSchema,
  location: staffWorkLocationSchema,
  assignee: staffWorkAssigneeSchema,
  messages: z.array(staffConversationMessageSchema),
  timeline: z.array(staffTimelineItemSchema),
});

export const adminOperationListQuerySchema = z
  .object({
    status: z.string().trim().min(1).max(40).optional().default('all'),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .refine(
    (input) =>
      !input.dateFrom || !input.dateTo || Date.parse(input.dateFrom) <= Date.parse(input.dateTo),
    {
      message: 'dateFrom must be before dateTo',
      path: ['dateFrom'],
    },
  );

export const adminOperationListResponseSchema = z.object({
  items: z.array(staffWorkItemSummarySchema),
  nextCursor: z.string().nullable(),
});

export const adminRequestDetailResponseSchema = z.object({
  detail: staffRequestDetailSchema,
});

export const adminOrderDetailResponseSchema = z.object({
  detail: staffOrderDetailSchema,
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

export const guestWorkItemSchema = z.discriminatedUnion('kind', [
  guestRequestSchema.extend({ kind: z.literal('request') }),
  guestOrderSchema.extend({ kind: z.literal('order') }),
]);

export const guestWorkItemsResponseSchema = z.object({
  items: z.array(guestWorkItemSchema),
});

export const guestRequestsResponseSchema = z.object({
  requests: z.array(guestRequestSchema),
});

export const guestOrdersResponseSchema = z.object({
  orders: z.array(guestOrderSchema),
});

export const guestRequestDetailResponseSchema = z.object({
  request: guestRequestSchema,
});

export const guestOrderDetailResponseSchema = z.object({
  order: guestOrderSchema,
});

export const guestCancelRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  reason: z.string().trim().max(500).optional(),
});

export const guestRequestCancelResponseSchema = z.object({
  request: guestRequestSchema,
  idempotentReplay: z.boolean(),
});

export const guestOrderCancelResponseSchema = z.object({
  order: guestOrderSchema,
  idempotentReplay: z.boolean(),
});

export const staffRequestClaimResponseSchema = z.object({
  request: guestRequestSchema,
  idempotentReplay: z.boolean(),
});

export const staffOrderClaimResponseSchema = z.object({
  order: guestOrderSchema,
  idempotentReplay: z.boolean(),
});

export type GuestWorkItemKind = z.infer<typeof guestWorkItemKindSchema>;
export type GuestDraftStatus = z.infer<typeof guestDraftStatusSchema>;
export type GuestRequestStatus = z.infer<typeof guestRequestStatusSchema>;
export type GuestOrderStatus = z.infer<typeof guestOrderStatusSchema>;
export type GuestSubmittedStatus = z.infer<typeof guestSubmittedStatusSchema>;
export type RequestDraftPayload = z.infer<typeof requestDraftPayloadSchema>;
export type OrderDraftItem = z.infer<typeof orderDraftItemSchema>;
export type OrderDraftPayload = z.infer<typeof orderDraftPayloadSchema>;
export type GuestRequestDraftCreateRequest = z.infer<typeof guestRequestDraftCreateRequestSchema>;
export type GuestOrderDraftCreateRequest = z.infer<typeof guestOrderDraftCreateRequestSchema>;
export type GuestDraftConfirmRequest = z.infer<typeof guestDraftConfirmRequestSchema>;
export type GuestRequestDraft = z.infer<typeof guestRequestDraftSchema>;
export type GuestOrderDraft = z.infer<typeof guestOrderDraftSchema>;
export type GuestRequest = z.infer<typeof guestRequestSchema>;
export type GuestOrder = z.infer<typeof guestOrderSchema>;
export type GuestRequestDraftCreateResponse = z.infer<typeof guestRequestDraftCreateResponseSchema>;
export type GuestOrderDraftCreateResponse = z.infer<typeof guestOrderDraftCreateResponseSchema>;
export type GuestRequestDraftConfirmResponse = z.infer<
  typeof guestRequestDraftConfirmResponseSchema
>;
export type GuestOrderDraftConfirmResponse = z.infer<typeof guestOrderDraftConfirmResponseSchema>;
export type StaffTransitionRequest = z.infer<typeof staffTransitionRequestSchema>;
export type StaffClaimRequest = z.infer<typeof staffClaimRequestSchema>;
export type StaffWorkItemSummary = z.infer<typeof staffWorkItemSummarySchema>;
export type StaffConversationMessage = z.infer<typeof staffConversationMessageSchema>;
export type StaffTimelineItem = z.infer<typeof staffTimelineItemSchema>;
export type StaffRequestDetail = z.infer<typeof staffRequestDetailSchema>;
export type StaffOrderDetail = z.infer<typeof staffOrderDetailSchema>;
export type AdminOperationListQuery = z.infer<typeof adminOperationListQuerySchema>;
export type AdminOperationListResponse = z.infer<typeof adminOperationListResponseSchema>;
export type AdminRequestDetailResponse = z.infer<typeof adminRequestDetailResponseSchema>;
export type AdminOrderDetailResponse = z.infer<typeof adminOrderDetailResponseSchema>;
export type GuestWorkItem = z.infer<typeof guestWorkItemSchema>;
export type GuestWorkItemsResponse = z.infer<typeof guestWorkItemsResponseSchema>;
export type GuestRequestsResponse = z.infer<typeof guestRequestsResponseSchema>;
export type GuestOrdersResponse = z.infer<typeof guestOrdersResponseSchema>;
export type GuestRequestDetailResponse = z.infer<typeof guestRequestDetailResponseSchema>;
export type GuestOrderDetailResponse = z.infer<typeof guestOrderDetailResponseSchema>;
export type GuestCancelRequest = z.infer<typeof guestCancelRequestSchema>;
export type GuestRequestCancelResponse = z.infer<typeof guestRequestCancelResponseSchema>;
export type GuestOrderCancelResponse = z.infer<typeof guestOrderCancelResponseSchema>;
export type StaffRequestClaimResponse = z.infer<typeof staffRequestClaimResponseSchema>;
export type StaffOrderClaimResponse = z.infer<typeof staffOrderClaimResponseSchema>;
