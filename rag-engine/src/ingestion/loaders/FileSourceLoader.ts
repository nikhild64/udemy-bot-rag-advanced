import fs from 'node:fs/promises';
import path from 'node:path';
import { ISourceLoader, SourceInput } from './ISourceLoader';
import { RawContent } from './RawContent';
import { StorageService } from '@/services/StorageService';
import { SourceLoaderError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export class FileSourceLoader implements ISourceLoader {
  constructor(private readonly storageService: StorageService = new StorageService()) {}

  async load(source: SourceInput): Promise<RawContent> {
    const startTime = Date.now();
    logger.info(
      { sourceId: source.id, notebookId: source.notebookId, loader: 'FileSourceLoader' },
      'Loading file source content',
    );

    const hasRawText =
      source.metadata &&
      typeof (source.metadata as any).rawText === 'string' &&
      (source.metadata as any).rawText.length > 0;

    // A stored rawText value is derived data. When the source still has a file
    // reference, always reload the file so stale/failed extraction output cannot
    // become the input for every subsequent retry.
    const hasLoadableFileReference = Boolean(
      source.storagePath || (source.fileUrl && !/^https?:\/\//i.test(source.fileUrl)),
    );
    const canUseRawTextFallback = hasRawText && !hasLoadableFileReference;

    if (!source.storagePath && !source.fileUrl && !canUseRawTextFallback) {
      throw new SourceLoaderError(
        `File source '${source.id}' is missing a storagePath, fileUrl, or rawText content`,
      );
    }

    const filePath = source.storagePath || source.fileUrl || '';
    let content: Buffer;

    try {
      if (canUseRawTextFallback) {
        content = Buffer.from((source.metadata as any).rawText, 'utf-8');
      } else if (filePath && (await this.isLocalFile(filePath))) {
        content = await fs.readFile(filePath);
      } else if (source.storagePath) {
        content = await this.storageService.downloadFile(source.storagePath);
      } else {
        throw new SourceLoaderError(`File source '${source.id}' has invalid storage path '${filePath}'`);
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        { sourceId: source.id, notebookId: source.notebookId, loader: 'FileSourceLoader', error: errorMsg, durationMs },
        'Failed to load file source content',
      );
      if (err instanceof SourceLoaderError) {
        throw err;
      }
      throw new SourceLoaderError(`Failed to load file source '${source.id}': ${errorMsg}`, { cause: err });
    }

    if (!content || content.length === 0) {
      throw new SourceLoaderError(`Loaded empty content for file source '${source.id}'`);
    }

    const mimeType = this.resolveMimeType(source.mimeType, filePath);
    const durationMs = Date.now() - startTime;

    logger.info(
      {
        sourceId: source.id,
        notebookId: source.notebookId,
        loader: 'FileSourceLoader',
        mimeType,
        sizeBytes: content.length,
        durationMs,
      },
      'Loaded file source content successfully',
    );

    return {
      sourceId: source.id,
      sourceType: String(source.type),
      mimeType,
      content,
      metadata: {
        title: source.title,
        displayName: source.displayName,
        storagePath: source.storagePath,
        fileUrl: source.fileUrl,
        size: content.length,
        ...(source.metadata || {}),
      },
    };
  }

  private async isLocalFile(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private resolveMimeType(providedMime?: string | null, filePath?: string | null): string {
    if (providedMime && providedMime.trim().length > 0) {
      return providedMime.toLowerCase();
    }

    if (!filePath || filePath === '') {
      return 'text/plain';
    }

    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.vtt':
        return 'text/vtt';
      case '.txt':
      case '.text':
        return 'text/plain';
      case '.md':
      case '.markdown':
        return 'text/markdown';
      case '.html':
      case '.htm':
        return 'text/html';
      case '.json':
        return 'application/json';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  }
}
