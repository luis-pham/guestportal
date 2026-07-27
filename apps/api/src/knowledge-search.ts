import {
  fuseRankedChannels,
  hashEmbedText,
  sanitizeRetrievalQuery,
  toCitations,
  toPgVectorLiteral,
  type ChannelHit,
  type RankedHit,
} from '@guestportal/rag';
import type { Sql } from '@guestportal/db';

type ChunkRow = {
  id: string;
  source_id: string;
  content: string;
  heading_path: string[] | null;
  source_language: string;
};

function mapChannel(
  rows: ChunkRow[],
  channel: ChannelHit['channel'],
): ChannelHit[] {
  return rows.map((row, index) => ({
    chunkId: row.id,
    sourceId: row.source_id,
    content: row.content,
    headingPath: row.heading_path ?? [],
    sourceLanguage: row.source_language,
    rank: index + 1,
    channel,
  }));
}

export async function hybridSearchKnowledge(input: {
  sql: Sql;
  organizationId: string;
  propertyId: string;
  query: string;
  limit?: number;
}): Promise<{
  query: string;
  sanitizedQuery: string;
  blocked: boolean;
  hits: RankedHit[];
  citations: ReturnType<typeof toCitations>;
  noResult: boolean;
}> {
  const limit = input.limit ?? 8;
  const sanitized = sanitizeRetrievalQuery(input.query);
  if (sanitized.blocked || !sanitized.query) {
    return {
      query: input.query,
      sanitizedQuery: sanitized.query,
      blocked: true,
      hits: [],
      citations: [],
      noResult: true,
    };
  }

  // Tenant/property filter is applied in every channel query before ranking.
  const vectorLiteral = toPgVectorLiteral(hashEmbedText(sanitized.query));

  const vectorRows = await input.sql<ChunkRow[]>`
    SELECT id, source_id, content, heading_path, source_language
    FROM knowledge_chunks
    WHERE organization_id = ${input.organizationId}::uuid
      AND property_id = ${input.propertyId}::uuid
      AND active = true
      AND embedding IS NOT NULL
      AND (embedding <=> ${vectorLiteral}::vector) < 0.92
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit * 2}
  `;

  const ftsRows = await input.sql<ChunkRow[]>`
    SELECT id, source_id, content, heading_path, source_language
    FROM knowledge_chunks
    WHERE organization_id = ${input.organizationId}::uuid
      AND property_id = ${input.propertyId}::uuid
      AND active = true
      AND content_tsv @@ plainto_tsquery('simple', ${sanitized.query})
    ORDER BY ts_rank_cd(content_tsv, plainto_tsquery('simple', ${sanitized.query})) DESC
    LIMIT ${limit * 2}
  `;

  const trgmRows = await input.sql<ChunkRow[]>`
    SELECT id, source_id, content, heading_path, source_language
    FROM knowledge_chunks
    WHERE organization_id = ${input.organizationId}::uuid
      AND property_id = ${input.propertyId}::uuid
      AND active = true
      AND similarity(content, ${sanitized.query}) > 0.15
    ORDER BY similarity(content, ${sanitized.query}) DESC
    LIMIT ${limit * 2}
  `;

  const hits = fuseRankedChannels(
    [
      mapChannel(vectorRows, 'vector'),
      mapChannel(ftsRows, 'fts'),
      mapChannel(trgmRows, 'trgm'),
    ],
    { limit },
  );

  const sourceIds = [...new Set(hits.map((h) => h.sourceId))];
  const titles: Record<string, string> = {};
  if (sourceIds.length > 0) {
    const sources = await input.sql<{ id: string; title: string }[]>`
      SELECT id, title FROM knowledge_sources
      WHERE organization_id = ${input.organizationId}::uuid
        AND property_id = ${input.propertyId}::uuid
        AND id = ANY(${sourceIds}::uuid[])
    `;
    for (const source of sources) titles[source.id] = source.title;
  }

  return {
    query: input.query,
    sanitizedQuery: sanitized.query,
    blocked: false,
    hits,
    citations: toCitations(hits, titles),
    noResult: hits.length === 0,
  };
}
