import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  PARSER_VERSION,
  chunkDocument,
  detectLanguage,
  hashEmbedText,
  parseDocument,
  toPgVectorLiteral,
} from '@guestportal/rag';
import { assets, knowledgeSources } from '@guestportal/db';
import { createR2Storage } from '@guestportal/storage';
import { ApiError } from './errors.js';

export async function processKnowledgeSource(
  app: FastifyInstance,
  input: {
    organizationId: string;
    propertyId: string;
    sourceId: string;
  },
) {
  const sourceRows = await app.db
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, input.sourceId),
        eq(knowledgeSources.propertyId, input.propertyId),
        eq(knowledgeSources.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  const source = sourceRows[0];
  if (!source) {
    throw new ApiError(404, 'KNOWLEDGE_NOT_FOUND', 'Knowledge source not found.');
  }
  if (!source.assetId) {
    throw new ApiError(400, 'KNOWLEDGE_NO_ASSET', 'Knowledge source has no uploaded asset.');
  }

  await app.db
    .update(knowledgeSources)
    .set({ status: 'processing', errorCode: null, errorMessage: null, updatedAt: new Date() })
    .where(eq(knowledgeSources.id, source.id));

  try {
    const assetRows = await app.db.select().from(assets).where(eq(assets.id, source.assetId)).limit(1);
    const asset = assetRows[0];
    if (!asset || asset.status !== 'ready') {
      throw new ApiError(400, 'ASSET_NOT_READY', 'Knowledge asset is not ready.');
    }

    const storage = createR2Storage();
    const bytes = await storage.getObjectBytes(asset.objectKey);
    if (!bytes || bytes.byteLength === 0) {
      throw new ApiError(400, 'ASSET_EMPTY', 'Knowledge object is empty or missing in storage.');
    }

    const document = await parseDocument({
      bytes,
      mimeType: asset.mimeType,
      filename: asset.originalFilename,
    });
    const language =
      source.sourceLanguage && source.sourceLanguage !== 'auto'
        ? source.sourceLanguage
        : detectLanguage(document.text).language;

    const prior = await app.sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM knowledge_chunks
      WHERE source_id = ${source.id}::uuid AND active = true
    `;
    const hasActive = Number(prior[0]?.count ?? '0') > 0;
    const version = hasActive ? source.version + 1 : Math.max(1, source.version);

    const drafts = chunkDocument(document.sections, { sourceLanguage: language });

    await app.sql`
      UPDATE knowledge_chunks
      SET active = false, invalidated_at = now()
      WHERE source_id = ${source.id}::uuid AND active = true
    `;

    for (const draft of drafts) {
      const vector = toPgVectorLiteral(hashEmbedText(draft.content));
      await app.sql`
        INSERT INTO knowledge_chunks (
          organization_id, property_id, source_id, ordinal, content, heading_path,
          source_language, content_hash, metadata, embedding, active, version
        ) VALUES (
          ${input.organizationId}::uuid,
          ${input.propertyId}::uuid,
          ${source.id}::uuid,
          ${draft.ordinal},
          ${draft.content},
          ${JSON.stringify(draft.headingPath)}::jsonb,
          ${draft.sourceLanguage},
          ${draft.contentHash},
          ${JSON.stringify(draft.metadata)}::jsonb,
          ${vector}::vector,
          true,
          ${version}
        )
      `;
    }

    const [updated] = await app.db
      .update(knowledgeSources)
      .set({
        status: 'ready',
        sourceLanguage: language,
        version,
        parserVersion: PARSER_VERSION,
        embeddingModel: 'embeddinggemma-300m',
        embeddingModelVersion: 'hashed-ngram-v1',
        checksumSha256: document.provenance.checksumSha256,
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, source.id))
      .returning();

    return {
      source: updated,
      chunkCount: drafts.length,
      version,
      language,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    const code = error instanceof ApiError ? error.code : 'PROCESS_FAILED';
    await app.db
      .update(knowledgeSources)
      .set({
        status: 'failed',
        errorCode: code,
        errorMessage: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, source.id));
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'PROCESS_FAILED', message);
  }
}
