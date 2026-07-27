import { z } from 'zod';

export const normalizedDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  mimeType: z.string(),
  title: z.string().nullable(),
  text: z.string(),
  sections: z.array(
    z.object({
      headingPath: z.array(z.string()),
      text: z.string(),
    }),
  ),
  provenance: z.object({
    filename: z.string().nullable(),
    checksumSha256: z.string(),
    parser: z.string(),
    parserVersion: z.string(),
    extractedAt: z.string().datetime(),
    byteLength: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()).default([]),
});

export type NormalizedDocument = z.infer<typeof normalizedDocumentSchema>;
