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
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      source: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
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

    it('should find notebooks with pagination', async () => {
      const repo = new PrismaNotebookRepository(mockPrisma);
      const mockList = [{ id: 'nb_1', title: 'My Notebook', userId: 'user_123' }];
      mockPrisma.notebook.findMany.mockResolvedValue(mockList);
      mockPrisma.notebook.count.mockResolvedValue(1);

      const result = await repo.findMany({ userId: 'user_123', page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('PrismaSourceRepository', () => {
    it('should create a source record with PendingUpload status by default', async () => {
      const repo = new PrismaSourceRepository(mockPrisma);
      const mockSource = {
        id: 'src_1',
        notebookId: 'nb_1',
        title: 'Doc.pdf',
        displayName: 'Doc.pdf',
        type: SourceType.PDF,
        status: SourceStatus.PendingUpload,
      };
      mockPrisma.source.create.mockResolvedValue(mockSource);

      const result = await repo.create({ notebookId: 'nb_1', title: 'Doc.pdf', type: SourceType.PDF });
      expect(result).toEqual(mockSource);
    });

    it('should update source status', async () => {
      const repo = new PrismaSourceRepository(mockPrisma);
      mockPrisma.source.findFirst.mockResolvedValue({ id: 'src_1', status: SourceStatus.PendingUpload });
      mockPrisma.source.update.mockResolvedValue({ id: 'src_1', status: SourceStatus.Indexed });

      const updated = await repo.updateStatus('src_1', SourceStatus.Indexed);
      expect(updated.status).toBe(SourceStatus.Indexed);
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
