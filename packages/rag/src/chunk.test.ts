import { describe, expect, it } from 'vitest';
import { CHUNKER_VERSION, chunkDocument } from './chunk.js';
import { detectLanguage } from './language.js';

describe('chunkDocument', () => {
  it('produces deterministic chunks with complete metadata', () => {
    const sections = [
      {
        headingPath: ['Amenities'],
        text: [
          'The outdoor pool is open from 06:00 to 22:00 every day.',
          'Towels are available at the pool desk.',
          'Children must be supervised by an adult at all times.',
        ].join('\n\n'),
      },
      {
        headingPath: ['Dining', 'Breakfast'],
        text: 'Breakfast is served from 06:30 to 10:00 in the Garden Restaurant.',
      },
    ];

    const first = chunkDocument(sections, { sourceLanguage: 'en', targetChars: 80, overlapChars: 10 });
    const second = chunkDocument(sections, { sourceLanguage: 'en', targetChars: 80, overlapChars: 10 });

    expect(first.length).toBeGreaterThan(1);
    expect(second).toEqual(first);
    expect(first[0]?.metadata.chunkerVersion).toBe(CHUNKER_VERSION);
    expect(first.every((c) => c.contentHash.length === 64)).toBe(true);
    expect(first.every((c) => c.sourceLanguage === 'en')).toBe(true);
    expect(first.some((c) => c.headingPath.includes('Breakfast'))).toBe(true);
  });

  it('does not drop non-empty section text', () => {
    const text = 'A'.repeat(50) + ' unique-marker-xyz ' + 'B'.repeat(50);
    const chunks = chunkDocument([{ headingPath: [], text }], {
      sourceLanguage: 'en',
      targetChars: 40,
      overlapChars: 5,
    });
    const joined = chunks.map((c) => c.content).join(' ');
    expect(joined).toContain('unique-marker-xyz');
  });
});

describe('detectLanguage', () => {
  it('detects Vietnamese and English fixtures', () => {
    const vi = detectLanguage(
      'Khách sạn cung cấp dịch vụ đưa đón sân bay và hồ bơi ngoài trời mở cửa hàng ngày.',
    );
    expect(vi.language).toBe('vi');
    expect(vi.confidence).toBeGreaterThan(0.3);

    const en = detectLanguage(
      'The hotel provides airport transfer and an outdoor pool open every day.',
    );
    expect(en.language).toBe('en');
  });

  it('detects Korean and Japanese signals', () => {
    expect(detectLanguage('수영장은 매일 오전 6시에 엽니다.').language).toBe('ko');
    expect(detectLanguage('プールは毎日6時から営業しています。').language).toBe('ja');
  });
});
