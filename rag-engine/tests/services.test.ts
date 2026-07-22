import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotebookService } from '@/services/NotebookService';
import { SourceService } from '@/services/SourceService';
import { SourceType } from '@prisma/client';

describe('Domain Services Unit Tests', () => {
  describe('NotebookService', () => {
    let mockNotebookRepo: any;
    let mockUserRepo: any;

    beforeEach(() => {
      mockNotebookRepo = {
        create: vi.fn(),
        findById: vi.fn(),
        findByUserId: vi.fn(),
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
  });

  describe('SourceService', () => {
    let mockSourceRepo: any;
    let mockNotebookRepo: any;
    let mockStorageService: any;

    beforeEach(() => {
      mockSourceRepo = {
        create: vi.fn(),
        findById: vi.fn(),
        findByNotebookId: vi.fn(),
        updateStatus: vi.fn(),
        delete: vi.fn(),
      };
      mockNotebookRepo = {
        findById: vi.fn(),
      };
      mockStorageService = {
        uploadFile: vi.fn(),
        deleteFile: vi.fn(),
      };
    });

    it('should throw NotFoundError if notebook is missing', async () => {
      const service = new SourceService(mockSourceRepo, mockNotebookRepo, mockStorageService);
      mockNotebookRepo.findById.mockResolvedValue(null);

      await expect(
        service.createSource('user_1', { notebookId: 'nb_99', title: 'Doc', type: SourceType.PDF }),
      ).rejects.toThrow();
    });

    it('should upload file buffer to storage if provided and save source record', async () => {
      const service = new SourceService(mockSourceRepo, mockNotebookRepo, mockStorageService);
      mockNotebookRepo.findById.mockResolvedValue({ id: 'nb_1', userId: 'user_1' });
      mockStorageService.uploadFile.mockResolvedValue({ path: 'path/file.pdf', publicUrl: 'http://storage/file.pdf' });
      mockSourceRepo.create.mockResolvedValue({ id: 'src_1', title: 'Doc.pdf', fileUrl: 'http://storage/file.pdf' });

      const buffer = Buffer.from('hello pdf');
      const source = await service.createSource('user_1', {
        notebookId: 'nb_1',
        title: 'Doc.pdf',
        type: SourceType.PDF,
        fileBuffer: buffer,
        fileName: 'Doc.pdf',
      });

      expect(mockStorageService.uploadFile).toHaveBeenCalled();
      expect(mockSourceRepo.create).toHaveBeenCalled();
      expect(source).toEqual({ id: 'src_1', title: 'Doc.pdf', fileUrl: 'http://storage/file.pdf' });
    });
  });
});
