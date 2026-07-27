import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  buildNormalizedDocument,
  checksumSha256,
  ParseError,
} from './normalize.js';
import { htmlToText } from './html.js';
import type { NormalizedDocument } from '@guestportal/contracts';

export { ParseError };

async function extractPdfText(bytes: Buffer): Promise<{ text: string; title: string | null }> {
  const data = new Uint8Array(bytes);
  const loadingTask = getDocument({ data, useSystemFonts: true, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    if (pageText.trim()) parts.push(pageText);
  }
  const meta = await pdf.getMetadata().catch(() => null);
  const info = meta?.info as { Title?: string } | undefined;
  return {
    text: parts.join('\n\n'),
    title: info?.Title ? String(info.Title) : null,
  };
}


export type ParseInput = {
  bytes: Buffer;
  mimeType: string;
  filename?: string | null;
};

export async function parseDocument(input: ParseInput): Promise<NormalizedDocument> {
  const checksum = checksumSha256(input.bytes);
  const filename = input.filename ?? null;
  const mime = input.mimeType.split(';')[0]!.trim().toLowerCase();

  try {
    switch (mime) {
      case 'text/plain':
      case 'text/markdown': {
        const text = input.bytes.toString('utf8');
        return buildNormalizedDocument({
          mimeType: mime,
          title: filename,
          text,
          filename,
          checksumSha256: checksum,
          parser: 'text',
          byteLength: input.bytes.byteLength,
        });
      }
      case 'text/html': {
        const { title, text, warnings } = htmlToText(input.bytes.toString('utf8'));
        return buildNormalizedDocument({
          mimeType: mime,
          title: title ?? filename,
          text,
          filename,
          checksumSha256: checksum,
          parser: 'html',
          byteLength: input.bytes.byteLength,
          warnings,
        });
      }
      case 'application/pdf': {
        const parsed = await extractPdfText(input.bytes);
        return buildNormalizedDocument({
          mimeType: mime,
          title: parsed.title ?? filename,
          text: parsed.text,
          filename,
          checksumSha256: checksum,
          parser: 'pdfjs',
          byteLength: input.bytes.byteLength,
          warnings: parsed.text.trim() ? [] : ['pdf_no_text_layer'],
        });
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const result = await mammoth.extractRawText({ buffer: input.bytes });
        return buildNormalizedDocument({
          mimeType: mime,
          title: filename,
          text: result.value ?? '',
          filename,
          checksumSha256: checksum,
          parser: 'mammoth',
          byteLength: input.bytes.byteLength,
          warnings: (result.messages ?? []).map((m) => m.message),
        });
      }
      default:
        throw new ParseError('UNSUPPORTED_MIME', `Unsupported mime type: ${mime}`);
    }
  } catch (error) {
    if (error instanceof ParseError) throw error;
    throw new ParseError(
      'PARSE_FAILED',
      error instanceof Error ? error.message : 'Document parsing failed.',
    );
  }
}
