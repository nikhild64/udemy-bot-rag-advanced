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

    // In case of TEXT/Markdown types where content might be embedded
    let rawText = null;
    if (source.type === 'TEXT' || source.type === 'MARKDOWN') {
      rawText = meta.rawText || null;
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
