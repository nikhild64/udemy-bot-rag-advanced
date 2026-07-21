import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { NotFoundError } from '@/shared/errors';
import { IArchiveInspector, ArchiveInspector } from './ArchiveInspector';
import { FileMetadata } from './FileMetadata';

export interface IInputDiscoveryService {
  discover(directoryPath?: string): Promise<FileMetadata[]>;
}

export class InputDiscoveryService implements IInputDiscoveryService {
  private readonly archiveInspector: IArchiveInspector;
  private readonly inputDirectory: string;

  constructor(
    archiveInspector?: IArchiveInspector,
    inputDirectory?: string,
  ) {
    this.archiveInspector = archiveInspector ?? new ArchiveInspector();
    this.inputDirectory = inputDirectory ?? config.ingestion.inputDirectory;
  }

  async discover(directoryPath?: string): Promise<FileMetadata[]> {
    const targetDirectory = directoryPath ?? this.inputDirectory;
    logger.info({ directory: targetDirectory }, 'Discovery started');

    try {
      const stats = await fs.stat(targetDirectory);
      if (!stats.isDirectory()) {
        throw new NotFoundError(`Input path is not a directory: ${targetDirectory}`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new NotFoundError(`Input directory not found: ${targetDirectory}`, {
        cause: error,
      });
    }

    const entries = await fs.readdir(targetDirectory, { withFileTypes: true });
    let filesScanned = 0;
    let invalidFilesSkipped = 0;
    const discoveredArchives: FileMetadata[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        continue;
      }

      filesScanned++;
      const fullPath = path.join(targetDirectory, entry.name);

      try {
        const metadata = await this.archiveInspector.inspect(fullPath);
        discoveredArchives.push(metadata);
      } catch (error) {
        invalidFilesSkipped++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(
          { err: errorMessage, file: fullPath },
          'Skipping invalid or unsupported file during discovery',
        );
      }
    }

    logger.info(
      {
        filesScanned,
        supportedArchives: discoveredArchives.length,
        invalidFilesSkipped,
      },
      'Discovery completed',
    );

    return discoveredArchives;
  }
}
