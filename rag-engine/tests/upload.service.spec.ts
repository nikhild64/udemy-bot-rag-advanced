import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UploadService } from '@/services/UploadService';
import { StorageService } from '@/services/StorageService';
import { SourceStatus, SourceType } from '@prisma/client';
import { NotFoundError, ValidationError, UnauthorizedError, StorageError } from '@/shared/errors';

describe('UploadService', () => {
  let uploadService: UploadService;
  let mockSourceRepository: any;
  let mockNotebookRepository: any;
  let mockStorageService: any;

  const mockUser = 'user_123';
  const mockNotebookId = 'nb_456';
  const mockSourceId = 'src_789';

  beforeEach(() => {
    mockSourceRepository = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
      update: vi.fn(),
    };

    mockNotebookRepository = {
      findById: vi.fn(),
    };

    mockStorageService = {
      validateUpload: vi.fn(),
      uploadFile: vi.fn(),
      deleteFile: vi.fn().mockResolvedValue(true),
    };

    uploadService = new UploadService(
      mockSourceRepository,
      mockNotebookRepository,
      mockStorageService as unknown as StorageService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully upload a file, store in storage, and update Source record to Uploaded status', async () => {
    const mockSource = {
      id: mockSourceId,
      notebookId: mockNotebookId,
      type: SourceType.PDF,
      status: SourceStatus.PendingUpload,
      metadata: {},
    };

    const mockNotebook = {
      id: mockNotebookId,
      userId: mockUser,
    };

    mockSourceRepository.findById.mockResolvedValue(mockSource);
    mockNotebookRepository.findById.mockResolvedValue(mockNotebook);
    mockStorageService.uploadFile.mockResolvedValue({
      path: `uploads/${mockUser}/${mockNotebookId}/${mockSourceId}/document.pdf`,
      publicUrl: `https://storage.supabase.co/notebook-sources/uploads/${mockUser}/${mockNotebookId}/${mockSourceId}/document.pdf`,
    });

    const updatedSource = {
      ...mockSource,
      status: SourceStatus.Uploaded,
      storagePath: `uploads/${mockUser}/${mockNotebookId}/${mockSourceId}/document.pdf`,
      fileUrl: `https://storage.supabase.co/notebook-sources/uploads/${mockUser}/${mockNotebookId}/${mockSourceId}/document.pdf`,
    };

    mockSourceRepository.update.mockResolvedValue(updatedSource);

    const payload = {
      filename: 'document.pdf',
      buffer: Buffer.from('PDF content here'),
      mimetype: 'application/pdf',
    };

    const result = await uploadService.uploadSourceFile(mockUser, mockSourceId, payload);

    expect(mockSourceRepository.findById).toHaveBeenCalledWith(mockSourceId);
    expect(mockNotebookRepository.findById).toHaveBeenCalledWith(mockNotebookId, mockUser);
    expect(mockStorageService.validateUpload).toHaveBeenCalledWith('document.pdf', 'application/pdf', payload.buffer.length);
    expect(mockSourceRepository.updateStatus).toHaveBeenCalledWith(mockSourceId, SourceStatus.Uploading);
    expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
      `uploads/${mockUser}/${mockNotebookId}/${mockSourceId}/document.pdf`,
      payload.buffer,
      'application/pdf',
    );
    expect(mockSourceRepository.update).toHaveBeenCalledWith(
      mockSourceId,
      mockUser,
      expect.objectContaining({
        status: SourceStatus.Uploaded,
        storagePath: `uploads/${mockUser}/${mockNotebookId}/${mockSourceId}/document.pdf`,
        mimeType: 'application/pdf',
        size: payload.buffer.length,
      }),
    );
    expect(result.status).toBe(SourceStatus.Uploaded);
    expect(result.storagePath).toContain(mockSourceId);
  });

  it('should throw NotFoundError if source does not exist', async () => {
    mockSourceRepository.findById.mockResolvedValue(null);

    await expect(
      uploadService.uploadSourceFile(mockUser, 'nonexistent', {
        filename: 'test.txt',
        buffer: Buffer.from('hello'),
        mimetype: 'text/plain',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError if notebook does not exist for user', async () => {
    mockSourceRepository.findById.mockResolvedValue({
      id: mockSourceId,
      notebookId: mockNotebookId,
      status: SourceStatus.PendingUpload,
    });
    mockNotebookRepository.findById.mockResolvedValue(null);

    await expect(
      uploadService.uploadSourceFile(mockUser, mockSourceId, {
        filename: 'test.txt',
        buffer: Buffer.from('hello'),
        mimetype: 'text/plain',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw UnauthorizedError if user does not own the notebook', async () => {
    mockSourceRepository.findById.mockResolvedValue({
      id: mockSourceId,
      notebookId: mockNotebookId,
      status: SourceStatus.PendingUpload,
    });
    mockNotebookRepository.findById.mockResolvedValue({
      id: mockNotebookId,
      userId: 'different_user',
    });

    await expect(
      uploadService.uploadSourceFile(mockUser, mockSourceId, {
        filename: 'test.txt',
        buffer: Buffer.from('hello'),
        mimetype: 'text/plain',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw ValidationError if source is already in Uploaded or Indexed status', async () => {
    mockSourceRepository.findById.mockResolvedValue({
      id: mockSourceId,
      notebookId: mockNotebookId,
      status: SourceStatus.Indexed,
    });
    mockNotebookRepository.findById.mockResolvedValue({
      id: mockNotebookId,
      userId: mockUser,
    });

    await expect(
      uploadService.uploadSourceFile(mockUser, mockSourceId, {
        filename: 'test.txt',
        buffer: Buffer.from('hello'),
        mimetype: 'text/plain',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should cleanup storage file and set Source status to Failed if storage upload fails', async () => {
    mockSourceRepository.findById.mockResolvedValue({
      id: mockSourceId,
      notebookId: mockNotebookId,
      status: SourceStatus.PendingUpload,
      metadata: {},
    });
    mockNotebookRepository.findById.mockResolvedValue({
      id: mockNotebookId,
      userId: mockUser,
    });
    mockStorageService.uploadFile.mockRejectedValue(new StorageError('Storage error'));

    const payload = {
      filename: 'sample.pdf',
      buffer: Buffer.from('pdf bytes'),
      mimetype: 'application/pdf',
    };

    await expect(uploadService.uploadSourceFile(mockUser, mockSourceId, payload)).rejects.toThrow(
      StorageError,
    );

    expect(mockSourceRepository.updateStatus).toHaveBeenCalledWith(mockSourceId, SourceStatus.Uploading);
    expect(mockStorageService.deleteFile).toHaveBeenCalled();
    expect(mockSourceRepository.updateStatus).toHaveBeenCalledWith(mockSourceId, SourceStatus.Failed);
  });
});
