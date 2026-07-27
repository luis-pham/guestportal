import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ParseError, parseDocument } from './parse.js';
import { htmlToText } from './html.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

describe('document parsers', () => {
  it('parses plain text with provenance checksum', async () => {
    const bytes = readFileSync(join(fixtures, 'sample.txt'));
    const doc = await parseDocument({
      bytes,
      mimeType: 'text/plain',
      filename: 'sample.txt',
    });
    expect(doc.text).toContain('aurora-guest');
    expect(doc.provenance.filename).toBe('sample.txt');
    expect(doc.provenance.checksumSha256).toHaveLength(64);
    expect(doc.provenance.parser).toBe('text');
    expect(doc.sections[0]?.text).toContain('Pool');
  });

  it('parses HTML, strips scripts, keeps title', async () => {
    const bytes = readFileSync(join(fixtures, 'sample.html'));
    const doc = await parseDocument({
      bytes,
      mimeType: 'text/html',
      filename: 'sample.html',
    });
    expect(doc.title).toBe('Hotel Guide');
    expect(doc.text).toContain('Check-out');
    expect(doc.text).not.toContain('alert');
    expect(doc.warnings).toContain('script_tags_removed');
  });

  it('parses PDF fixture with provenance', async () => {
    const bytes = readFileSync(join(fixtures, 'sample.pdf'));
    const doc = await parseDocument({
      bytes,
      mimeType: 'application/pdf',
      filename: 'sample.pdf',
    });
    expect(doc.text).toContain('Pool hours');
    expect(doc.provenance.parser).toBe('pdfjs');
    expect(doc.provenance.checksumSha256).toHaveLength(64);
  });

  it('parses DOCX fixture with provenance', async () => {
    const bytes = readFileSync(join(fixtures, 'sample.docx'));
    const doc = await parseDocument({
      bytes,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: 'sample.docx',
    });
    expect(doc.text).toContain('Spa opens daily');
    expect(doc.provenance.parser).toBe('mammoth');
  });

  it('rejects empty and unsupported documents', async () => {
    await expect(
      parseDocument({ bytes: Buffer.from('   \n'), mimeType: 'text/plain' }),
    ).rejects.toBeInstanceOf(ParseError);

    await expect(
      parseDocument({ bytes: Buffer.from('MZ'), mimeType: 'application/octet-stream' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_MIME' });
  });

  it('html helper preserves readable text', () => {
    const { text } = htmlToText('<p>One</p><p>Two</p>');
    expect(text).toContain('One');
    expect(text).toContain('Two');
  });
});
