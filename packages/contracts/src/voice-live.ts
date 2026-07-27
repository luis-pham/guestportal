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

export type VoiceLiveSessionCreateRequest = z.infer<
  typeof voiceLiveSessionCreateRequestSchema
>;
export type VoiceLiveSession = z.infer<typeof voiceLiveSessionSchema>;
export type VoiceLiveSessionCreateResponse = z.infer<
  typeof voiceLiveSessionCreateResponseSchema
>;
