import fs from 'node:fs/promises';
import path from 'node:path';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { FileMetadata } from './FileMetadata';

export interface IArchiveInspector {
  validate(filePath: string): Promise<void>;
  inspect(filePath: string): Promise<FileMetadata>;
}

export class ArchiveInspector implements IArchiveInspector {
  private readonly supportedExtensions: ReadonlySet<string>;

  constructor(supportedExtensions: readonly string[] = ['.zip']) {
    this.supportedExtensions = new Set(
      supportedExtensions.map((ext) => ext.toLowerCase()),
    );
  }

  async validate(filePath: string): Promise<void> {
    try {
      await fs.stat(filePath);
    } catch {
      throw new NotFoundError(`File not found: ${filePath}`);
    }

    const extension = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.has(extension)) {
      throw new ValidationError(
        `Unsupported file extension "${extension}" for file: ${filePath}`,
      );
    }

    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch {
      throw new ValidationError(`File is not readable: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new ValidationError(`Empty archive (0 bytes): ${filePath}`);
    }
  }

  async inspect(filePath: string): Promise<FileMetadata> {
    await this.validate(filePath);

    const stats = await fs.stat(filePath);
    const absolutePath = path.resolve(filePath);
    const name = path.basename(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();

    return {
      name,
      path: absolutePath,
      extension,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  }
}
