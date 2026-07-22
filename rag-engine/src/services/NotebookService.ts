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
      isArchived: options?.isArchived,
      isFavorite: options?.isFavorite,
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

  async duplicateNotebook(id: string, userId: string): Promise<Notebook> {
    const sourceNotebook = await this.getNotebook(id, userId);
    const newTitle = `Copy of ${sourceNotebook.title}`.substring(0, 255);

    logger.info({ id, userId, newTitle }, 'Duplicating notebook');
    return this.createNotebook(
      userId,
      newTitle,
      sourceNotebook.description ?? undefined,
      (sourceNotebook.settings as Record<string, any>) ?? undefined,
    );
  }

  async archiveNotebook(id: string, userId: string, isArchived: boolean = true): Promise<Notebook> {
    logger.info({ id, userId, isArchived }, 'Archiving notebook');
    return this.updateNotebook(id, userId, { isArchived });
  }

  async toggleFavorite(id: string, userId: string, isFavorite?: boolean): Promise<Notebook> {
    const existing = await this.getNotebook(id, userId);
    const targetState = isFavorite !== undefined ? isFavorite : !existing.isFavorite;
    logger.info({ id, userId, isFavorite: targetState }, 'Toggling notebook favorite state');
    return this.updateNotebook(id, userId, { isFavorite: targetState });
  }

  async touchLastOpened(id: string, userId: string): Promise<Notebook> {
    return this.updateNotebook(id, userId, { lastOpenedAt: new Date() });
  }

  async getRecentNotebooks(userId: string, limit: number = 5): Promise<Notebook[]> {
    const result = await this.notebookRepository.findMany({
      userId,
      isArchived: false,
      limit,
      sortBy: 'lastOpenedAt',
      sortOrder: 'desc',
    });
    return result.data;
  }

  async deleteNotebook(id: string, userId: string): Promise<boolean> {
    logger.info({ id, userId }, 'Deleting notebook');
    return this.notebookRepository.delete(id, userId);
  }
}
