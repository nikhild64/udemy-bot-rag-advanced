import { SourceStatus } from '@prisma/client';
import { ISourceRepository, INotebookRepository } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { StorageService } from './StorageService';
import { NotFoundError, ValidationError, UnauthorizedError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import path from 'node:path';

import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';

export interface FileUploadPayload {
  filename: string;
  buffer: Buffer;
  mimetype: string;
}

export interface UploadSourceResponse {
  sourceId: string;
  status: SourceStatus;
  storagePath: string;
  fileUrl?: string | undefined;
  uploadedAt: string;
}

export class UploadService {
  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly storageService: StorageService = new StorageService(),
    private readonly queue: IngestionQueue = new IngestionQueue(),
  ) {}

  async uploadSourceFile(
    userId: string,
    sourceId: string,
    filePayload: FileUploadPayload,
  ): Promise<UploadSourceResponse> {
    if (!userId) {
      throw new UnauthorizedError('User authentication required');
    }

    if (!sourceId) {
      throw new ValidationError('Source ID is required');
    }

    if (!filePayload || !filePayload.buffer) {
      throw new ValidationError('No file uploaded');
    }

    // 1. Fetch Source
    const source = await this.sourceRepository.findById(sourceId);
    if (!source) {
      throw new NotFoundError(`Source '${sourceId}' not found`);
    }

    // 2. Validate Notebook existence and ownership
    const notebook = await this.notebookRepository.findById(source.notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${source.notebookId}' not found for current user`);
    }

    if (notebook.userId !== userId) {
      throw new UnauthorizedError(`User does not own the notebook for source '${sourceId}'`);
    }

    // 3. Validate Source Status
    const allowedStatuses: SourceStatus[] = [
      SourceStatus.PendingUpload,
      SourceStatus.Uploading,
      SourceStatus.Failed,
    ];

    if (!allowedStatuses.includes(source.status)) {
      throw new ValidationError(
        `Source '${sourceId}' cannot accept file upload in current status '${source.status}'`,
      );
    }

    // 4. Validate File Properties
    this.storageService.validateUpload(
      filePayload.filename,
      filePayload.mimetype,
      filePayload.buffer.length,
    );

    // 5. Update Source Status to Uploading
    await this.sourceRepository.updateStatus(sourceId, SourceStatus.Uploading);

    // 6. Generate backend-controlled storage path
    const sanitizedFilename = path.basename(filePayload.filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storagePath = `uploads/${userId}/${source.notebookId}/${source.id}/${sanitizedFilename}`;

    try {
      // 7. Store file in Supabase Storage
      const storageResult = await this.storageService.uploadFile(
        storagePath,
        filePayload.buffer,
        filePayload.mimetype,
      );

      const uploadedAt = new Date().toISOString();
      const existingMetadata = (source.metadata as Record<string, any>) || {};

      // 8. Update Source record with metadata and Uploaded status
      const updatedSource = await this.sourceRepository.update(sourceId, userId, {
        storagePath: storageResult.path,
        fileUrl: storageResult.publicUrl || null,
        mimeType: filePayload.mimetype,
        size: filePayload.buffer.length,
        status: SourceStatus.Uploaded,
        metadata: {
          ...existingMetadata,
          uploadedAt,
          originalName: filePayload.filename,
        },
      });

      logger.info(
        { sourceId, storagePath, size: filePayload.buffer.length },
        'File uploaded and source status updated to Uploaded',
      );

      // 9. Enqueue Ingestion Job asynchronously
      try {
        await this.queue.enqueueJob({
          sourceId: updatedSource.id,
          notebookId: source.notebookId,
          userId,
          storagePath: updatedSource.storagePath || storagePath,
          mimeType: filePayload.mimetype,
        });

        await this.sourceRepository.updateStatus(sourceId, SourceStatus.Queued);
      } catch (queueErr) {
        logger.warn({ queueErr, sourceId }, 'Failed to enqueue ingestion job; source remains Uploaded');
      }

      return {
        sourceId: updatedSource.id,
        status: updatedSource.status,
        storagePath: updatedSource.storagePath || storagePath,
        fileUrl: updatedSource.fileUrl || undefined,
        uploadedAt,
      };
    } catch (err: any) {
      logger.error(
        { error: err, sourceId, storagePath },
        'Upload failed, attempting cleanup and status rollback',
      );

      // Cleanup: remove any partial file stored
      try {
        await this.storageService.deleteFile(storagePath);
      } catch (cleanupErr) {
        logger.warn({ cleanupErr, storagePath }, 'Failed to delete partial file during cleanup');
      }

      // Rollback Source status to Failed
      try {
        await this.sourceRepository.updateStatus(sourceId, SourceStatus.Failed);
      } catch (statusErr) {
        logger.warn({ statusErr, sourceId }, 'Failed to set source status to Failed after error');
      }

      throw err;
    }
  }
}
