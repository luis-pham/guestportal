import { z } from 'zod';

export const conversationStatusSchema = z.enum(['active', 'handed_off', 'closed', 'expired']);

export const transcriptRetentionPolicySchema = z.enum([
  'standard_30_days',
  'extended_90_days',
]);

export const conversationRoleSchema = z.enum(['guest', 'assistant', 'staff', 'system', 'tool']);

export const conversationMessageSourceSchema = z.enum([
  'guest_web',
  'assistant',
  'staff_web',
  'system',
  'tool_gateway',
]);

export const conversationCreateRequestSchema = z.object({
  locale: z.string().trim().min(2).max(16).optional(),
  retentionPolicy: transcriptRetentionPolicySchema.default('standard_30_days'),
});

export const guestMessageCreateRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  originalLanguage: z.string().trim().min(2).max(16).optional(),
  translatedText: z.string().trim().min(1).max(4000).optional(),
  clientMessageId: z.string().trim().min(1).max(120).optional(),
});

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  status: conversationStatusSchema,
  locale: z.string(),
  retentionPolicy: transcriptRetentionPolicySchema,
  retentionExpiresAt: z.string().datetime(),
  lastMessageSequence: z.number().int().min(0),
  handedOffAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const conversationMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sequence: z.number().int().positive(),
  role: conversationRoleSchema,
  source: conversationMessageSourceSchema,
  originalLanguage: z.string().nullable(),
  originalText: z.string(),
  translatedText: z.string().nullable(),
  toolName: z.string().nullable(),
  toolPayload: z.record(z.unknown()).nullable(),
  requestId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  clientMessageId: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const conversationCreateResponseSchema = z.object({
  conversation: conversationSummarySchema,
});

export const conversationDetailResponseSchema = z.object({
  conversation: conversationSummarySchema,
  messages: z.array(conversationMessageSchema),
});

export const guestMessageCreateResponseSchema = z.object({
  message: conversationMessageSchema,
});

export type ConversationStatus = z.infer<typeof conversationStatusSchema>;
export type TranscriptRetentionPolicy = z.infer<typeof transcriptRetentionPolicySchema>;
export type ConversationRole = z.infer<typeof conversationRoleSchema>;
export type ConversationMessageSource = z.infer<typeof conversationMessageSourceSchema>;
export type ConversationCreateRequest = z.infer<typeof conversationCreateRequestSchema>;
export type GuestMessageCreateRequest = z.infer<typeof guestMessageCreateRequestSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationCreateResponse = z.infer<typeof conversationCreateResponseSchema>;
export type ConversationDetailResponse = z.infer<typeof conversationDetailResponseSchema>;
export type GuestMessageCreateResponse = z.infer<typeof guestMessageCreateResponseSchema>;
