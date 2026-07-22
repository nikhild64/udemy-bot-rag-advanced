import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotebookService } from '@/services/NotebookService';
import { SourceService } from '@/services/SourceService';
import { SourceType, SourceStatus } from '@prisma/client';

describe('Domain Services Unit Tests', () => {
  describe('NotebookService', () => {
    let mockNotebookRepo: any;
    let mockUserRepo: any;

    beforeEach(() => {
      mockNotebookRepo = {
        create: vi.fn(),
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      mockUserRepo = {
        findOrCreate: vi.fn(),
      };
    });

    it('should invoke user findOrCreate and create notebook', async () => {
      const service = new NotebookService(mockNotebookRepo, mockUserRepo);
      mockUserRepo.findOrCreate.mockResolvedValue({ id: 'user_1' });
      mockNotebookRepo.create.mockResolvedValue({ id: 'nb_1', title: 'Test', userId: 'user_1' });

      const notebook = await service.createNotebook('user_1', 'Test');
      expect(notebook).toEqual({ id: 'nb_1', title: 'Test', userId: 'user_1' });
      expect(mockUserRepo.findOrCreate).toHaveBeenCalledWith({ id: 'user_1' });
      expect(mockNotebookRepo.create).toHaveBeenCalledWith({
        userId: 'user_1',
        title: 'Test',
        description: null,
        settings: null,
      });
    });

    it('should throw ValidationError if title is empty', async () => {
      const service = new NotebookService(mockNotebookRepo, mockUserRepo);
      await expect(service.createNotebook('user_1', '')).rejects.toThrow('Notebook title is required');
    });
  });

  describe('SourceService', () => {
    let mockSourceRepo: any;
    let mockNotebookRepo: any;

    beforeEach(() => {
      mockSourceRepo = {
        create: vi.fn(),
        findById: vi.fn(),
        findByNotebookId: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateStatus: vi.fn(),
        delete: vi.fn(),
      };
      mockNotebookRepo = {
        findById: vi.fn(),
      };
    });

    it('should throw NotFoundError if notebook is missing or not owned by user', async () => {
      const service = new SourceService(mockSourceRepo, mockNotebookRepo);
      mockNotebookRepo.findById.mockResolvedValue(null);

      await expect(
        service.createSource('user_1', { notebookId: 'nb_99', title: 'Doc', type: SourceType.PDF }),
      ).rejects.toThrow("Notebook 'nb_99' not found for user");
    });

    it('should create source metadata with default PendingUpload status', async () => {
      const service = new SourceService(mockSourceRepo, mockNotebookRepo);
      mockNotebookRepo.findById.mockResolvedValue({ id: 'nb_1', userId: 'user_1' });
      mockSourceRepo.create.mockResolvedValue({
        id: 'src_1',
        notebookId: 'nb_1',
        displayName: 'Doc.pdf',
        type: SourceType.PDF,
        status: SourceStatus.PendingUpload,
      });

      const source = await service.createSource('user_1', {
        notebookId: 'nb_1',
        displayName: 'Doc.pdf',
        type: SourceType.PDF,
      });

      expect(mockSourceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notebookId: 'nb_1',
          displayName: 'Doc.pdf',
          type: SourceType.PDF,
          status: SourceStatus.PendingUpload,
        }),
      );
      expect(source.status).toBe(SourceStatus.PendingUpload);
    });
  });
});
