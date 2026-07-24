import { ISourceRepository } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { NotFoundError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export interface ViewableSource {
  sourceId: string;
  notebookId: string;
  type: string;
  displayName: string;
  url: string | null;
  rawText: string | null;
  mimeType: string | null;
  metadata: Record<string, any>;
}

export class SourceViewerService {
  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
  ) {}

  async getSourceForViewing(sourceId: string, userId: string): Promise<ViewableSource> {
    const source = await this.sourceRepository.findById(sourceId, userId);
    if (!source) {
      throw new NotFoundError(`Source '${sourceId}' not found for viewing`);
    }

    logger.info({ sourceId, type: source.type }, 'Resolved source for viewing');

    const meta = (source.metadata as Record<string, any>) || {};

    let url = source.fileUrl || null;
    if (!url && source.storagePath) {
      // Create a relative or absolute URL to our storage endpoint
      url = `/api/storage/files/${source.storagePath}`;
    }

    // Extract raw text or transcript across all source types (PDF, Youtube, Audio, Website, Text)
    let rawText = meta.rawText || meta.transcript || meta.extractedText || meta.content || null;

    // Fallback for existing sources: Recover transcript/text from Qdrant vector store points
    if (!rawText) {
      try {
        const { VectorStoreFactory } = await import('@/providers/vectorstore/VectorStoreFactory');
        const vectorStore = VectorStoreFactory.create();
        const client = (vectorStore as any).client;
        const collectionName = (vectorStore as any).collectionName;

        if (client && collectionName) {
          const scrollRes = await client.scroll(collectionName, {
            filter: {
              should: [
                { key: 'lessonId', match: { value: source.id } },
                { key: 'sourceId', match: { value: source.id } },
              ],
            },
            limit: 500,
            with_payload: true,
            with_vector: false,
          });

          if (scrollRes.points && scrollRes.points.length > 0) {
            const sorted = scrollRes.points.sort((a: any, b: any) => {
              const idxA = a.payload?.chunkIndex ?? a.payload?.startTime ?? 0;
              const idxB = b.payload?.chunkIndex ?? b.payload?.startTime ?? 0;
              return idxA - idxB;
            });

            const texts = sorted
              .map((p: any) => String(p.payload?.text || p.payload?.chunkText || p.payload?.content || '').trim())
              .filter(Boolean);

            if (texts.length > 0) {
              rawText = texts.join('\n\n');
            }
          }
        }
      } catch (err) {
        logger.warn({ sourceId: source.id, err }, 'Failed to fetch vector chunks for viewer fallback');
      }
    }

    return {
      sourceId: source.id,
      notebookId: source.notebookId,
      type: source.type,
      displayName: source.displayName || source.title,
      url,
      rawText,
      mimeType: source.mimeType,
      metadata: meta,
    };
  }
}
