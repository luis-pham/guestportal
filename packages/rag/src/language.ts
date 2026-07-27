export type DetectedLanguage = {
  language: string;
  confidence: number;
};

const VI_CHARS = /[ăâêôơưđàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵĂÂÊÔƠƯĐ]/u;
const KO_CHARS = /[\uac00-\ud7af]/;
const JA_KANA = /[\u3040-\u30ff]/;
const CJK = /[\u4e00-\u9fff]/;
const FR_CHARS = /[àâæçéèêëïîôœùûüÿÀÂÆÇÉÈÊËÏÎÔŒÙÛÜŸ]/;

function ratio(matches: number, total: number): number {
  if (total <= 0) return 0;
  return matches / total;
}

/** Lightweight locale detector for VI/EN/KO/JA/ZH/FR (Phase 05 guest locales). */
export function detectLanguage(text: string): DetectedLanguage {
  const sample = text.replace(/\s+/g, ' ').trim().slice(0, 4000);
  if (!sample) return { language: 'und', confidence: 0 };

  const letters = sample.replace(/[^\p{L}]/gu, '');
  const total = letters.length || sample.length;

  const vi = (sample.match(new RegExp(VI_CHARS.source, 'gu')) ?? []).length;
  const ko = (sample.match(new RegExp(KO_CHARS.source, 'gu')) ?? []).length;
  const ja = (sample.match(new RegExp(JA_KANA.source, 'gu')) ?? []).length;
  const cjk = (sample.match(new RegExp(CJK.source, 'gu')) ?? []).length;
  const fr = (sample.match(new RegExp(FR_CHARS.source, 'gu')) ?? []).length;

  const candidates: DetectedLanguage[] = [
    { language: 'vi', confidence: ratio(vi, total) },
    { language: 'ko', confidence: ratio(ko, total) },
    { language: 'ja', confidence: ratio(ja, total) },
    {
      language: 'zh',
      confidence: ja === 0 ? ratio(cjk, total) : ratio(Math.max(0, cjk - ja), total) * 0.5,
    },
    { language: 'fr', confidence: ratio(fr, total) * (vi > 0 ? 0.2 : 1) },
  ];

  candidates.sort((a, b) => b.confidence - a.confidence);
  const top = candidates[0]!;
  if (top.confidence >= 0.02) {
    return { language: top.language, confidence: Math.min(1, top.confidence * 8) };
  }

  // Latin-dominant → English default for hotel content without strong FR/VI signals.
  const latin = (letters.match(/[A-Za-z]/g) ?? []).length;
  if (ratio(latin, total) > 0.6) {
    return { language: 'en', confidence: 0.7 };
  }

  return { language: 'und', confidence: 0.2 };
}
