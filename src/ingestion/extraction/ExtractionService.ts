import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { ExtractionError } from '@/shared/errors';
import { FileMetadata } from '../discovery/FileMetadata';
import { IArchiveExtractor, ArchiveExtractor } from './ArchiveExtractor';
import { ExtractionOptions } from './ExtractionOptions';
import { ExtractionResult } from './ExtractionResult';

export interface IExtractionService {
  extract(
    archive: FileMetadata | string,
    options?: ExtractionOptions,
  ): Promise<ExtractionResult>;
  extractAll(
    archives: readonly (FileMetadata | string)[],
    options?: ExtractionOptions,
  ): Promise<ExtractionResult[]>;
}

export class ExtractionService implements IExtractionService {
  private readonly archiveExtractor: IArchiveExtractor;
  private readonly extractionDirectory: string;

  constructor(
    archiveExtractor?: IArchiveExtractor,
    extractionDirectory?: string,
  ) {
    this.archiveExtractor = archiveExtractor ?? new ArchiveExtractor();
    this.extractionDirectory =
      extractionDirectory ?? config.ingestion.extractionDirectory;
  }

  async extract(
    archive: FileMetadata | string,
    options?: ExtractionOptions,
  ): Promise<ExtractionResult> {
    const archivePath =
      typeof archive === 'string' ? path.resolve(archive) : path.resolve(archive.path);
    const archiveName =
      typeof archive === 'string' ? path.basename(archivePath) : archive.name;

    const baseExtractionDir = path.resolve(
      options?.destinationDirectory ?? this.extractionDirectory,
    );
    const directoryName = path.parse(archiveName).name;
    const destinationPath = path.join(baseExtractionDir, directoryName);

    logger.info(
      {
        archiveName,
        archivePath,
        destinationPath,
      },
      'Extraction started',
    );

    const shouldClean = options?.cleanBeforeExtract !== false;
    if (shouldClean) {
      try {
        await fs.rm(destinationPath, { recursive: true, force: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            archiveName,
            destinationPath,
            err: errorMessage,
          },
          'Extraction failed during destination clean',
        );
        throw new ExtractionError(
          `Failed to clean destination directory "${destinationPath}": ${errorMessage}`,
          { cause: error },
        );
      }
    }

    try {
      const result = await this.archiveExtractor.extract(archivePath, destinationPath);

      logger.info(
        {
          archiveName: result.archiveName,
          destinationPath: result.destinationPath,
          filesExtractedCount: result.filesExtracted.length,
          durationMs: result.durationMs,
          success: true,
        },
        'Extraction completed successfully',
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          archiveName,
          destinationPath,
          err: errorMessage,
        },
        'Extraction failed',
      );
      throw error;
    }
  }

  async extractAll(
    archives: readonly (FileMetadata | string)[],
    options?: ExtractionOptions,
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    for (const archive of archives) {
      const result = await this.extract(archive, options);
      results.push(result);
    }
    return results;
  }
}
