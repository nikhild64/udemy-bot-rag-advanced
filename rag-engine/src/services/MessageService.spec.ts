import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from './MessageService';
import { IMessageRepository, INotebookRepository } from '@/repositories/interfaces';
import { MessageRole } from '@prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors';

describe('MessageService', () => {
  let mockMessageRepo: IMessageRepository;
  let mockNotebookRepo: INotebookRepository;
  let service: MessageService;

  beforeEach(() => {
    mockMessageRepo = {
      create: vi.fn(),
      findByNotebookId: vi.fn(),
      deleteByNotebookId: vi.fn(),
    };

    mockNotebookRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new MessageService(mockMessageRepo, mockNotebookRepo);
  });

  describe('createMessage', () => {
    it('should create message successfully when notebook ownership matches', async () => {
      (mockNotebookRepo.findById as any).mockResolvedValue({
        id: 'nb_1',
        userId: 'user_1',
        title: 'Notebook 1',
      });

      const mockMessage = {
        id: 'msg_1',
        notebookId: 'nb_1',
        role: MessageRole.USER,
        content: 'Hello AI',
        citations: [],
        metadata: {},
        createdAt: new Date(),
      };
      (mockMessageRepo.create as any).mockResolvedValue(mockMessage);

      const result = await service.createMessage({
        notebookId: 'nb_1',
        userId: 'user_1',
        role: MessageRole.USER,
        content: 'Hello AI',
      });

      expect(mockNotebookRepo.findById).toHaveBeenCalledWith('nb_1');
      expect(mockMessageRepo.create).toHaveBeenCalledWith({
        notebookId: 'nb_1',
        role: MessageRole.USER,
        content: 'Hello AI',
        citations: [],
        metadata: {},
      });
      expect(result).toEqual(mockMessage);
    });

    it('should throw ValidationError if notebookId or content is missing', async () => {
      await expect(
        service.createMessage({
          notebookId: '',
          userId: 'user_1',
          role: MessageRole.USER,
          content: 'test',
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createMessage({
          notebookId: 'nb_1',
          userId: 'user_1',
          role: MessageRole.USER,
          content: '  ',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if notebook does not exist', async () => {
      (mockNotebookRepo.findById as any).mockResolvedValue(null);

      await expect(
        service.createMessage({
          notebookId: 'nb_missing',
          userId: 'user_1',
          role: MessageRole.USER,
          content: 'Hello',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw UnauthorizedError if user does not own notebook', async () => {
      (mockNotebookRepo.findById as any).mockResolvedValue({
        id: 'nb_1',
        userId: 'other_user',
      });

      await expect(
        service.createMessage({
          notebookId: 'nb_1',
          userId: 'user_1',
          role: MessageRole.USER,
          content: 'Hello',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getNotebookMessages', () => {
    it('should return messages for valid notebook owner', async () => {
      (mockNotebookRepo.findById as any).mockResolvedValue({
        id: 'nb_1',
        userId: 'user_1',
      });

      const messages = [
        { id: 'msg_1', notebookId: 'nb_1', role: MessageRole.USER, content: 'Hi' },
      ];
      (mockMessageRepo.findByNotebookId as any).mockResolvedValue(messages);

      const result = await service.getNotebookMessages('nb_1', 'user_1', 20);

      expect(mockNotebookRepo.findById).toHaveBeenCalledWith('nb_1');
      expect(mockMessageRepo.findByNotebookId).toHaveBeenCalledWith('nb_1', 20);
      expect(result).toEqual(messages);
    });
  });

  describe('clearNotebookMessages', () => {
    it('should delete notebook messages for valid owner', async () => {
      (mockNotebookRepo.findById as any).mockResolvedValue({
        id: 'nb_1',
        userId: 'user_1',
      });
      (mockMessageRepo.deleteByNotebookId as any).mockResolvedValue(5);

      const count = await service.clearNotebookMessages('nb_1', 'user_1');

      expect(count).toBe(5);
      expect(mockMessageRepo.deleteByNotebookId).toHaveBeenCalledWith('nb_1');
    });
  });
});
