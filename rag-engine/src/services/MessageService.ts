import { Message, MessageRole } from '@prisma/client';
import { IMessageRepository, INotebookRepository, CreateMessageInput } from '@/repositories/interfaces';
import { PrismaMessageRepository } from '@/repositories/PrismaMessageRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export interface CreateNotebookMessageDTO {
  notebookId: string;
  userId: string;
  role: MessageRole;
  content: string;
  citations?: any[];
  metadata?: Record<string, any>;
}

export class MessageService {
  constructor(
    private readonly messageRepository: IMessageRepository = new PrismaMessageRepository(),
    private readonly notebookRepository: INotebookRepository = new PrismaNotebookRepository(),
  ) {}

  /**
   * Persists a message within a notebook after validating ownership.
   */
  public async createMessage(dto: CreateNotebookMessageDTO): Promise<Message> {
    if (!dto.notebookId || typeof dto.notebookId !== 'string') {
      throw new ValidationError('notebookId is required');
    }
    if (!dto.userId || typeof dto.userId !== 'string') {
      throw new ValidationError('userId is required');
    }
    if (!dto.content || typeof dto.content !== 'string' || dto.content.trim().length === 0) {
      throw new ValidationError('Message content cannot be empty');
    }

    const notebook = await this.notebookRepository.findById(dto.notebookId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with ID ${dto.notebookId} not found`);
    }
    if (notebook.userId !== dto.userId) {
      throw new UnauthorizedError('Unauthorized access to this notebook');
    }

    const input: CreateMessageInput = {
      notebookId: dto.notebookId,
      role: dto.role,
      content: dto.content.trim(),
      citations: dto.citations ?? [],
      metadata: dto.metadata ?? {},
    };

    const message = await this.messageRepository.create(input);
    logger.info(
      { messageId: message.id, notebookId: dto.notebookId, role: dto.role },
      'Notebook message persisted successfully',
    );
    return message;
  }

  /**
   * Retrieves historical messages for a notebook after checking ownership.
   */
  public async getNotebookMessages(
    notebookId: string,
    userId: string,
    limit: number = 50,
  ): Promise<Message[]> {
    if (!notebookId) {
      throw new ValidationError('notebookId is required');
    }
    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const notebook = await this.notebookRepository.findById(notebookId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with ID ${notebookId} not found`);
    }
    if (notebook.userId !== userId) {
      throw new UnauthorizedError('Unauthorized access to this notebook');
    }

    return this.messageRepository.findByNotebookId(notebookId, limit);
  }

  /**
   * Clears all messages for a specific notebook.
   */
  public async clearNotebookMessages(notebookId: string, userId: string): Promise<number> {
    if (!notebookId || !userId) {
      throw new ValidationError('notebookId and userId are required');
    }

    const notebook = await this.notebookRepository.findById(notebookId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with ID ${notebookId} not found`);
    }
    if (notebook.userId !== userId) {
      throw new UnauthorizedError('Unauthorized access to this notebook');
    }

    const count = await this.messageRepository.deleteByNotebookId(notebookId);
    logger.info({ notebookId, count }, 'Notebook messages cleared');
    return count;
  }

  /**
   * Deletes a specific message and all messages in the notebook created after it.
   */
  public async deleteMessageAndSubsequent(
    messageId: string,
    notebookId: string,
    userId: string,
  ): Promise<number> {
    if (!messageId || !notebookId || !userId) {
      throw new ValidationError('messageId, notebookId, and userId are required');
    }

    const notebook = await this.notebookRepository.findById(notebookId);
    if (!notebook) {
      throw new NotFoundError(`Notebook with ID ${notebookId} not found`);
    }
    if (notebook.userId !== userId) {
      throw new UnauthorizedError('Unauthorized access to this notebook');
    }

    const count = await this.messageRepository.deleteFromMessageId(messageId, notebookId);
    logger.info({ messageId, notebookId, count }, 'Deleted message and all subsequent messages');
    return count;
  }
}
