import { Notebook } from '@prisma/client';
import { INotebookRepository, IUserRepository, UpdateNotebookInput } from '@/repositories/interfaces';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { logger } from '@/shared/logger';

export class NotebookService {
  constructor(
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
    private readonly userRepository: IUserRepository = new PrismaUserRepository(),
  ) {}

  async createNotebook(userId: string, title: string, description?: string, settings?: Record<string, any>): Promise<Notebook> {
    logger.info({ userId, title }, 'Creating notebook');
    // Ensure user exists
    await this.userRepository.findOrCreate({ id: userId });

    return this.notebookRepository.create({
      userId,
      title,
      description: description ?? null,
      settings: settings ?? null,
    });
  }

  async getNotebook(id: string, userId: string): Promise<Notebook | null> {
    return this.notebookRepository.findById(id, userId);
  }

  async listUserNotebooks(userId: string): Promise<Notebook[]> {
    return this.notebookRepository.findByUserId(userId);
  }

  async updateNotebook(id: string, userId: string, data: UpdateNotebookInput): Promise<Notebook> {
    logger.info({ id, userId }, 'Updating notebook');
    return this.notebookRepository.update(id, userId, data);
  }

  async deleteNotebook(id: string, userId: string): Promise<boolean> {
    logger.info({ id, userId }, 'Deleting notebook');
    return this.notebookRepository.delete(id, userId);
  }
}
