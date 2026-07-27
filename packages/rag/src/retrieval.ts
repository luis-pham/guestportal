export type RankedHit = {
  chunkId: string;
  sourceId: string;
  content: string;
  headingPath: string[];
  sourceLanguage: string;
  score: number;
  channels: Array<'vector' | 'fts' | 'trgm'>;
};

export type Citation = {
  sourceId: string;
  chunkId: string;
  title: string;
  headingPath: string[];
  excerpt: string;
  score: number;
};

export type ChannelHit = {
  chunkId: string;
  sourceId: string;
  content: string;
  headingPath: string[];
  sourceLanguage: string;
  rank: number;
  channel: 'vector' | 'fts' | 'trgm';
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now\s+dan/i,
  /<\s*\/?\s*script\s*>/i,
];

/** Strip / flag prompt-injection style payloads before retrieval. */
export function sanitizeRetrievalQuery(query: string): {
  query: string;
  blocked: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let cleaned = query.split('\u0000').join(' ').trim();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      reasons.push(pattern.source);
      cleaned = cleaned.replace(pattern, ' ');
    }
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return {
    query: cleaned,
    blocked: cleaned.length === 0 && reasons.length > 0,
    reasons,
  };
}

/** Reciprocal Rank Fusion across retrieval channels. */
export function fuseRankedChannels(
  channels: ChannelHit[][],
  options?: { k?: number; limit?: number },
): RankedHit[] {
  const k = options?.k ?? 60;
  const limit = options?.limit ?? 8;
  const byId = new Map<string, RankedHit>();

  for (const channelHits of channels) {
    for (const hit of channelHits) {
      const contribution = 1 / (k + hit.rank);
      const existing = byId.get(hit.chunkId);
      if (!existing) {
        byId.set(hit.chunkId, {
          chunkId: hit.chunkId,
          sourceId: hit.sourceId,
          content: hit.content,
          headingPath: hit.headingPath,
          sourceLanguage: hit.sourceLanguage,
          score: contribution,
          channels: [hit.channel],
        });
      } else {
        existing.score += contribution;
        if (!existing.channels.includes(hit.channel)) {
          existing.channels.push(hit.channel);
        }
      }
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, limit);
}

export function toCitations(
  hits: RankedHit[],
  sourceTitles: Record<string, string>,
): Citation[] {
  return hits.map((hit) => ({
    sourceId: hit.sourceId,
    chunkId: hit.chunkId,
    title: sourceTitles[hit.sourceId] ?? 'Knowledge source',
    headingPath: hit.headingPath,
    excerpt: hit.content.slice(0, 280),
    score: hit.score,
  }));
}

export function computeRecallAtK(
  retrievedIds: string[],
  relevantIds: string[],
  k: number,
): number {
  if (relevantIds.length === 0) return 0;
  const top = new Set(retrievedIds.slice(0, k));
  const hits = relevantIds.filter((id) => top.has(id)).length;
  return hits / relevantIds.length;
}
