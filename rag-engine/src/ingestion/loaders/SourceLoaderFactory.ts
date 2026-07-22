import { SourceType } from '@prisma/client';
import { ISourceLoader, SourceInput } from './ISourceLoader';
import { FileSourceLoader } from './FileSourceLoader';
import { WebsiteLoader } from './WebsiteLoader';
import { YouTubeLoader } from './YouTubeLoader';
import { StorageService } from '@/services/StorageService';
import { ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export class SourceLoaderFactory {
  /**
   * Resolves and returns the appropriate ISourceLoader implementation based on SourceType or properties.
   */
  static getLoader(
    type?: SourceType | string | null,
    sourceInput?: Partial<SourceInput> | null,
    storageService?: StorageService,
  ): ISourceLoader {
    const typeStr = (type || sourceInput?.type || '').toString().toUpperCase();
    const url = sourceInput?.fileUrl || sourceInput?.metadata?.url || '';

    logger.debug({ typeStr, url }, 'Resolving SourceLoader for ingestion');

    if (typeStr === 'WEBSITE' || typeStr === 'HTML' || url.includes('http://') || url.includes('https://')) {
      if (typeStr !== 'YOUTUBE' && !url.includes('youtube.com') && !url.includes('youtu.be')) {
        return new WebsiteLoader(storageService ? { storageService } : {});
      }
    }

    if (typeStr === 'YOUTUBE' || url.includes('youtube.com') || url.includes('youtu.be')) {
      return new YouTubeLoader(storageService ? { storageService } : {});
    }

    if (
      typeStr === 'PDF' ||
      typeStr === 'TEXT' ||
      typeStr === 'TXT' ||
      typeStr === 'VTT' ||
      typeStr === 'DOCX' ||
      typeStr === 'PPTX' ||
      typeStr === 'MARKDOWN' ||
      typeStr === 'FILE' ||
      sourceInput?.storagePath
    ) {
      return new FileSourceLoader(storageService);
    }

    // Default fallback to FileSourceLoader if storage path is present or unknown file type
    if (sourceInput?.storagePath || !typeStr) {
      return new FileSourceLoader(storageService);
    }

    throw new ValidationError(`Unsupported source type for loading: '${typeStr || 'UNKNOWN'}'`);
  }
}
