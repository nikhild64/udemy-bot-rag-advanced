import { Source, SourceType, SourceStatus } from '@prisma/client';
import { ISourceRepository, INotebookRepository } from '@/repositories/interfaces';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { StorageService } from './StorageService';
import { NotFoundError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export class SourceService {
  constructor(
    private readonly sourceRepository: ISourceRepository = new PrismaSourceRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly storageService: StorageService = new StorageService(),
  ) {}

  async createSource(
    userId: string,
    input: {
      notebookId: string;
      title: string;
      type: SourceType;
      fileBuffer?: Buffer;
      fileName?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<Source> {
    const notebook = await this.notebookRepository.findById(input.notebookId, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${input.notebookId}' not found for user`);
    }

    let storagePath: string | null = null;
    let fileUrl: string | null = null;

    if (input.fileBuffer && input.fileName) {
      storagePath = `notebooks/${input.notebookId}/${Date.now()}_${input.fileName}`;
      const uploadRes = await this.storageService.uploadFile(storagePath, input.fileBuffer);
      fileUrl = uploadRes.publicUrl ?? null;
    }

    const source = await this.sourceRepository.create({
      notebookId: input.notebookId,
      title: input.title,
      type: input.type,
      storagePath,
      fileUrl,
      metadata: input.metadata ?? null,
    });

    logger.info({ sourceId: source.id, notebookId: input.notebookId }, 'Created source entity');
    return source;
  }

  async getSource(id: string): Promise<Source | null> {
    return this.sourceRepository.findById(id);
  }

  async listSources(notebookId: string): Promise<Source[]> {
    return this.sourceRepository.findByNotebookId(notebookId);
  }

  async updateSourceStatus(id: string, status: SourceStatus): Promise<Source> {
    return this.sourceRepository.updateStatus(id, status);
  }

  async deleteSource(id: string): Promise<boolean> {
    const source = await this.sourceRepository.findById(id);
    if (!source) {
      throw new NotFoundError(`Source '${id}' not found`);
    }

    if (source.storagePath) {
      await this.storageService.deleteFile(source.storagePath);
    }

    return this.sourceRepository.delete(id);
  }
}
