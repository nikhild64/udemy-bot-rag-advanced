import fs from 'node:fs/promises';
import path from 'node:path';
import extract from 'extract-zip';
import { ValidationError, ExtractionError } from '@/shared/errors';
import { IArchiveInspector, ArchiveInspector } from '../discovery/ArchiveInspector';
import { ExtractionResult } from './ExtractionResult';

export interface IArchiveExtractor {
  extract(archivePath: string, destinationPath: string): Promise<ExtractionResult>;
}

export class ArchiveExtractor implements IArchiveExtractor {
  private readonly archiveInspector: IArchiveInspector;

  constructor(archiveInspector?: IArchiveInspector) {
    this.archiveInspector = archiveInspector ?? new ArchiveInspector();
  }

  async extract(archivePath: string, destinationPath: string): Promise<ExtractionResult> {
    const resolvedArchivePath = path.resolve(archivePath);
    const resolvedDestinationPath = path.resolve(destinationPath);

    // Verify archive exists and is valid (throws NotFoundError or ValidationError if invalid)
    await this.archiveInspector.validate(resolvedArchivePath);

    // Ensure destination directory exists and is accessible
    try {
      await fs.mkdir(resolvedDestinationPath, { recursive: true });
      await fs.access(resolvedDestinationPath, fs.constants.W_OK);
    } catch (error) {
      throw new ExtractionError(
        `Destination directory unavailable or permission denied: ${resolvedDestinationPath}`,
        { cause: error },
      );
    }

    const filesExtracted: string[] = [];
    const startTime = Date.now();

    try {
      await extract(resolvedArchivePath, {
        dir: resolvedDestinationPath,
        onEntry: (entry) => {
          if (!entry.fileName.endsWith('/')) {
            filesExtracted.push(entry.fileName);
          }
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const lowerMessage = errorMessage.toLowerCase();

      if (
        lowerMessage.includes('corrupt') ||
        lowerMessage.includes('end of central directory') ||
        lowerMessage.includes('invalid zip') ||
        lowerMessage.includes('signature') ||
        lowerMessage.includes('bad zip')
      ) {
        throw new ValidationError(`Corrupt archive: ${resolvedArchivePath}`, {
          cause: error,
        });
      }

      throw new ExtractionError(
        `Failed to extract archive "${resolvedArchivePath}": ${errorMessage}`,
        { cause: error },
      );
    }

    const durationMs = Date.now() - startTime;

    return {
      archiveName: path.basename(resolvedArchivePath),
      destinationPath: resolvedDestinationPath,
      filesExtracted,
      durationMs,
      success: true,
    };
  }
}
