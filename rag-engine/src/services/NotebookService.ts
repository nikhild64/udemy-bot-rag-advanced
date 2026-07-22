import { Notebook } from '@prisma/client';
import { INotebookRepository, IUserRepository, UpdateNotebookInput, ListNotebooksQuery, PaginatedResult } from '@/repositories/interfaces';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export class NotebookService {
  constructor(
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly userRepository: IUserRepository = new PrismaUserRepository(),
  ) {}

  async createNotebook(userId: string, title: string, description?: string | undefined, settings?: Record<string, any> | undefined): Promise<Notebook> {
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Notebook title is required');
    }
    if (title.length > 255) {
      throw new ValidationError('Notebook title cannot exceed 255 characters');
    }

    logger.info({ userId, title }, 'Creating notebook');
    await this.userRepository.findOrCreate({ id: userId });

    return this.notebookRepository.create({
      userId,
      title: title.trim(),
      description: description ?? null,
      settings: settings ?? null,
    });
  }

  async getNotebook(id: string, userId: string): Promise<Notebook> {
    const notebook = await this.notebookRepository.findById(id, userId);
    if (!notebook) {
      throw new NotFoundError(`Notebook '${id}' not found for user`);
    }
    return notebook;
  }

  async listUserNotebooks(userId: string, options?: Partial<ListNotebooksQuery> | undefined): Promise<PaginatedResult<Notebook>> {
    return this.notebookRepository.findMany({
      userId,
      page: options?.page,
      limit: options?.limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async updateNotebook(id: string, userId: string, data: UpdateNotebookInput): Promise<Notebook> {
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new ValidationError('Notebook title cannot be empty');
      }
      if (data.title.length > 255) {
        throw new ValidationError('Notebook title cannot exceed 255 characters');
      }
    }

    logger.info({ id, userId }, 'Updating notebook');
    return this.notebookRepository.update(id, userId, data);
  }

  async deleteNotebook(id: string, userId: string): Promise<boolean> {
    logger.info({ id, userId }, 'Deleting notebook');
    return this.notebookRepository.delete(id, userId);
  }
}
