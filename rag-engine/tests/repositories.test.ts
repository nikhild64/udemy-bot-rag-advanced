import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaUserRepository } from '@/repositories/PrismaUserRepository';
import { PrismaNotebookRepository } from '@/repositories/PrismaNotebookRepository';
import { PrismaSourceRepository } from '@/repositories/PrismaSourceRepository';
import { PrismaMessageRepository } from '@/repositories/PrismaMessageRepository';
import { SourceType, SourceStatus, MessageRole } from '@prisma/client';

describe('Repository Layer Unit Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      notebook: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      source: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      message: {
        create: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
  });

  describe('PrismaUserRepository', () => {
    it('should find user by id', async () => {
      const repo = new PrismaUserRepository(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });

      const user = await repo.findById('user_123');
      expect(user).toEqual({ id: 'user_123', email: 'test@example.com' });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user_123' } });
    });

    it('should findOrCreate user if not existing', async () => {
      const repo = new PrismaUserRepository(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });

      const user = await repo.findOrCreate({ id: 'user_123', email: 'test@example.com' });
      expect(user).toEqual({ id: 'user_123', email: 'test@example.com' });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });

  describe('PrismaNotebookRepository', () => {
    it('should create a notebook', async () => {
      const repo = new PrismaNotebookRepository(mockPrisma);
      const mockNotebook = { id: 'nb_1', title: 'My Notebook', userId: 'user_123' };
      mockPrisma.notebook.create.mockResolvedValue(mockNotebook);

      const result = await repo.create({ title: 'My Notebook', userId: 'user_123' });
      expect(result).toEqual(mockNotebook);
      expect(mockPrisma.notebook.create).toHaveBeenCalledWith({
        data: { title: 'My Notebook', description: null, userId: 'user_123', settings: {} },
      });
    });

    it('should find notebooks by userId', async () => {
      const repo = new PrismaNotebookRepository(mockPrisma);
      mockPrisma.notebook.findMany.mockResolvedValue([{ id: 'nb_1', title: 'My Notebook', userId: 'user_123' }]);

      const result = await repo.findByUserId('user_123');
      expect(result).toHaveLength(1);
      expect(mockPrisma.notebook.findMany).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { sources: true, messages: true } } },
      });
    });
  });

  describe('PrismaSourceRepository', () => {
    it('should create a source record', async () => {
      const repo = new PrismaSourceRepository(mockPrisma);
      const mockSource = { id: 'src_1', notebookId: 'nb_1', title: 'Doc.pdf', type: SourceType.PDF, status: SourceStatus.PENDING };
      mockPrisma.source.create.mockResolvedValue(mockSource);

      const result = await repo.create({ notebookId: 'nb_1', title: 'Doc.pdf', type: SourceType.PDF });
      expect(result).toEqual(mockSource);
    });

    it('should update source status', async () => {
      const repo = new PrismaSourceRepository(mockPrisma);
      mockPrisma.source.findUnique.mockResolvedValue({ id: 'src_1', status: SourceStatus.PENDING });
      mockPrisma.source.update.mockResolvedValue({ id: 'src_1', status: SourceStatus.COMPLETED });

      const updated = await repo.updateStatus('src_1', SourceStatus.COMPLETED);
      expect(updated.status).toBe(SourceStatus.COMPLETED);
    });
  });

  describe('PrismaMessageRepository', () => {
    it('should create and retrieve messages for a notebook', async () => {
      const repo = new PrismaMessageRepository(mockPrisma);
      const mockMsg = { id: 'msg_1', notebookId: 'nb_1', role: MessageRole.USER, content: 'Hello' };
      mockPrisma.message.create.mockResolvedValue(mockMsg);
      mockPrisma.message.findMany.mockResolvedValue([mockMsg]);

      const created = await repo.create({ notebookId: 'nb_1', role: MessageRole.USER, content: 'Hello' });
      expect(created).toEqual(mockMsg);

      const list = await repo.findByNotebookId('nb_1');
      expect(list).toEqual([mockMsg]);
    });
  });
});
