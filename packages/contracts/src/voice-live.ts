import { z } from 'zod';

export const voiceLiveSessionCreateRequestSchema = z.object({
  conversationId: z.string().uuid(),
  locale: z.string().trim().min(2).max(16).optional(),
});

export const voiceLiveSessionModelSchema = z.string().trim().min(1);

export const voiceLiveSessionSchema = z.object({
  token: z.string().trim().min(1),
  tokenType: z.literal('gemini_ephemeral'),
  model: voiceLiveSessionModelSchema,
  conversationId: z.string().uuid(),
  locale: z.string(),
  newSessionExpiresAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  uses: z.literal(1),
  constraints: z.object({
    responseModalities: z.array(z.literal('AUDIO')).length(1),
    sessionResumption: z.literal(true),
  }),
});

export const voiceLiveSessionCreateResponseSchema = z.object({
  liveSession: voiceLiveSessionSchema,
});

export const voiceMetricEventNameSchema = z.enum([
  'live_connected',
  'transcript_received',
  'interrupted',
  'reconnect_attempt',
  'reconnect_succeeded',
  'latency_sample',
]);

export const voiceMetricCreateRequestSchema = z.object({
  eventName: voiceMetricEventNameSchema,
  valueMs: z.number().int().min(0).max(120_000).optional(),
  reconnectAttempt: z.number().int().min(0).max(10).optional(),
  transcriptRole: z.enum(['guest', 'assistant']).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const voiceMetricCreateResponseSchema = z.object({
  metric: z.object({
    conversationId: z.string().uuid(),
    eventName: voiceMetricEventNameSchema,
    acceptedAt: z.string().datetime(),
  }),
});

export type VoiceLiveSessionCreateRequest = z.infer<
  typeof voiceLiveSessionCreateRequestSchema
>;
export type VoiceLiveSession = z.infer<typeof voiceLiveSessionSchema>;
export type VoiceLiveSessionCreateResponse = z.infer<
  typeof voiceLiveSessionCreateResponseSchema
>;
export type VoiceMetricEventName = z.infer<typeof voiceMetricEventNameSchema>;
export type VoiceMetricCreateRequest = z.infer<typeof voiceMetricCreateRequestSchema>;
export type VoiceMetricCreateResponse = z.infer<typeof voiceMetricCreateResponseSchema>;
