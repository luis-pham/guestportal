import { createHash } from 'node:crypto';
import type { NormalizedDocument } from '@guestportal/contracts';
import { normalizedDocumentSchema } from '@guestportal/contracts';

export const PARSER_VERSION = '1.0.0';

export class ParseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function checksumSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildNormalizedDocument(input: {
  mimeType: string;
  title: string | null;
  text: string;
  sections?: NormalizedDocument['sections'];
  filename?: string | null;
  checksumSha256: string;
  parser: string;
  byteLength: number;
  warnings?: string[];
}): NormalizedDocument {
  const text = collapseWhitespace(input.text);
  if (!text) {
    throw new ParseError('EMPTY_DOCUMENT', 'Parsed document contains no extractable text.');
  }
  return normalizedDocumentSchema.parse({
    schemaVersion: 1,
    mimeType: input.mimeType,
    title: input.title,
    text,
    sections: input.sections?.length
      ? input.sections
      : [{ headingPath: [], text }],
    provenance: {
      filename: input.filename ?? null,
      checksumSha256: input.checksumSha256,
      parser: input.parser,
      parserVersion: PARSER_VERSION,
      extractedAt: new Date().toISOString(),
      byteLength: input.byteLength,
    },
    warnings: input.warnings ?? [],
  });
}
