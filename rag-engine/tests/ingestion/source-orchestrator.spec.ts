import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceIngestionOrchestrator } from '@/ingestion/orchestrator/SourceIngestionOrchestrator';
import { SourceStatus, SourceType } from '@prisma/client';
import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';

describe('SourceIngestionOrchestrator', () => {
  let orchestrator: SourceIngestionOrchestrator;
  let mockSourceRepo: any;
  let mockNotebookRepo: any;
  let mockStorageService: any;
  let mockEmbeddingService: any;
  let mockVectorStore: any;
  let queue: IngestionQueue;

  const sampleSource = {
    id: 'src-123',
    notebookId: 'nb-456',
    type: SourceType.TEXT,
    title: 'Test Document',
    displayName: 'Test Doc',
    status: SourceStatus.Uploaded,
    storagePath: 'uploads/user-1/nb-456/src-123/file.txt',
    mimeType: 'text/plain',
    size: 100,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleNotebook = {
    id: 'nb-456',
    title: 'My Notebook',
    userId: 'user-789',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    queue = new IngestionQueue();
    await queue.clear();

    mockSourceRepo = {
      findById: vi.fn().mockResolvedValue(sampleSource),
      updateStatus: vi.fn().mockResolvedValue(sampleSource),
      update: vi.fn().mockImplementation((id, userId, data) => Promise.resolve({ ...sampleSource, ...data })),
    };

    mockNotebookRepo = {
      findById: vi.fn().mockResolvedValue(sampleNotebook),
    };

    mockStorageService = {
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('This is a test source document content for indexing.', 'utf-8')),
    };

    mockEmbeddingService = {
      embedChunks: vi.fn().mockImplementation((chunks) =>
        Promise.resolve({
          success: true,
          embeddedChunks: chunks.map((c: any) => ({
            ...c,
            embedding: new Array(1024).fill(0.1),
          })),
          errors: [],
        }),
      ),
    };

    mockVectorStore = {
      collectionExists: vi.fn().mockResolvedValue(true),
      createCollection: vi.fn().mockResolvedValue(true),
      deleteVectors: vi.fn().mockResolvedValue(true),
      upsert: vi.fn().mockResolvedValue(undefined),
    };

    orchestrator = new SourceIngestionOrchestrator(
      mockSourceRepo,
      mockNotebookRepo,
      mockStorageService,
      mockEmbeddingService,
      mockVectorStore,
      queue,
    );
  });

  it('should run full ingestion workflow and transition source to Indexed', async () => {
    const result = await orchestrator.ingestSource('src-123', 'nb-456', 'user-789');

    expect(result.success).toBe(true);
    expect(result.status).toBe(SourceStatus.Indexed);
    expect(result.chunksCount).toBeGreaterThan(0);
    expect(result.embeddingsCount).toBeGreaterThan(0);

    expect(mockSourceRepo.updateStatus).toHaveBeenCalledWith('src-123', SourceStatus.Processing);
    expect(mockStorageService.downloadFile).toHaveBeenCalledWith(sampleSource.storagePath);
    expect(mockVectorStore.deleteVectors).toHaveBeenCalled(); // Idempotency check
    expect(mockVectorStore.upsert).toHaveBeenCalled();
    expect(mockSourceRepo.update).toHaveBeenCalledWith(
      'src-123',
      'user-789',
      expect.objectContaining({ status: SourceStatus.Indexed }),
    );

    // Verify progress updated in queue
    const status = await queue.getJobStatus('src-123');
    expect(status?.status).toBe('Indexed');
    expect(status?.progress).toBe(100);
  });

  it('should fail gracefully if notebook ownership does not match user', async () => {
    mockNotebookRepo.findById.mockResolvedValueOnce({ ...sampleNotebook, userId: 'other-user' });

    const result = await orchestrator.ingestSource('src-123', 'nb-456', 'user-789');

    expect(result.success).toBe(false);
    expect(result.status).toBe(SourceStatus.Failed);
    expect(result.error).toContain('does not own notebook');
  });
});
