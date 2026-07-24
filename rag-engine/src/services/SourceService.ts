import { Source, SourceType, SourceStatus } from '@prisma/client';
import { ISourceRepository, INotebookRepository, UpdateSourceInput, ListSourcesQuery, PaginatedResult } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { SourceDeletionOrchestrator } from '../ingestion/orchestrator/SourceDeletionOrchestrator';
import { ReIndexOrchestrator } from '../ingestion/orchestrator/ReIndexOrchestrator';

export class SourceService {
  private readonly deletionOrchestrator: SourceDeletionOrchestrator;
  private readonly reindexOrchestrator: ReIndexOrchestrator;

  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    deletionOrchestrator?: SourceDeletionOrchestrator,
    reindexOrchestrator?: ReIndexOrchestrator,
  ) {
    this.deletionOrchestrator = deletionOrchestrator ?? new SourceDeletionOrchestrator(this.sourceRepository, this.notebookRepository);
    this.reindexOrchestrator = reindexOrchestrator ?? new ReIndexOrchestrator(this.sourceRepository, this.notebookRepository);
  }

  async createSource(
    userId: string,
    input: {
      notebookId: string;
      type: SourceType;
      displayName?: string | undefined;
      title?: string | undefined;
      storagePath?: string | undefined;
      fileUrl?: string | undefined;
      mimeType?: string | undefined;
      size?: number | undefined;
      metadata?: Record<string, any> | undefined;
      status?: SourceStatus | undefined;
    },
  ): Promise<Source> {
    const notebook = await this.notebookRepository.findById(input.notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${input.notebookId}' not found for user`);
    }

    if (!input.type) {
      throw new ValidationError('Source type is required');
    }

    const displayName = input.displayName ?? input.title ?? 'Untitled Source';

    const source = await this.sourceRepository.create({
      notebookId: input.notebookId,
      type: input.type,
      displayName,
      title: displayName,
      storagePath: input.storagePath ?? null,
      fileUrl: input.fileUrl ?? null,
      mimeType: input.mimeType ?? null,
      size: input.size ?? null,
      metadata: input.metadata ?? null,
      status: input.status ?? SourceStatus.PendingUpload,
    });

    logger.info({ sourceId: source.id, notebookId: input.notebookId }, 'Created source metadata');
    return source;
  }

  async getSource(id: string, userId: string): Promise<Source> {
    const source = await this.sourceRepository.findById(id, userId);
    if (!source) {
      throw new NotFoundError(`Source '${id}' not found for user`);
    }
    return source;
  }

  async listSources(
    notebookId: string,
    userId: string,
    options?: Partial<ListSourcesQuery> | undefined,
  ): Promise<PaginatedResult<Source>> {
    const notebook = await this.notebookRepository.findById(notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${notebookId}' not found for user`);
    }

    return this.sourceRepository.findMany({
      notebookId,
      userId,
      type: options?.type,
      status: options?.status,
      page: options?.page,
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async updateSource(id: string, userId: string, data: UpdateSourceInput): Promise<Source> {
    logger.info({ sourceId: id, userId }, 'Updating source metadata');
    return this.sourceRepository.update(id, userId, data);
  }

  async updateSourceStatus(id: string, status: SourceStatus): Promise<Source> {
    return this.sourceRepository.updateStatus(id, status);
  }

  async reindexSource(id: string, userId: string): Promise<Source> {
    return this.reindexOrchestrator.reindexSource(id, userId);
  }

  async retrySource(id: string, userId: string): Promise<Source> {
    const source = await this.getSource(id, userId);
    logger.info({ sourceId: id, userId }, 'Retrying ingestion for source');
    return this.sourceRepository.update(id, userId, {
      status: SourceStatus.Queued,
      metadata: {
        ...((source.metadata as Record<string, any>) || {}),
        retriedAt: new Date().toISOString(),
      },
    });
  }

  async cancelSource(id: string, userId: string): Promise<Source> {
    const source = await this.getSource(id, userId);
    logger.info({ sourceId: id, userId }, 'Cancelling source processing');
    return this.sourceRepository.update(id, userId, {
      status: 'Failed',
      metadata: {
        ...((source.metadata as Record<string, any>) || {}),
        cancelledAt: new Date().toISOString(),
      },
    });
  }

  async getSourceMetadata(id: string, userId: string): Promise<Record<string, any>> {
    const source = await this.getSource(id, userId);
    return {
      id: source.id,
      notebookId: source.notebookId,
      title: source.title,
      displayName: source.displayName,
      type: source.type,
      status: source.status,
      storagePath: source.storagePath,
      fileUrl: source.fileUrl,
      mimeType: source.mimeType,
      size: source.size,
      metadata: source.metadata,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  async deleteSource(id: string, userId: string): Promise<boolean> {
    return this.deletionOrchestrator.deleteSource(id, userId);
  }
}
