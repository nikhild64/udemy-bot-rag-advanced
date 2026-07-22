import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionWorker } from '../src/workers/IngestionWorker';
import { IngestionQueue, IngestionJobData } from '../src/infrastructure/queue/IngestionQueue';
import { SourceIngestionOrchestrator } from '../src/ingestion/orchestrator/SourceIngestionOrchestrator';

describe('IngestionWorker process lifecycle', () => {
  let mockQueue: IngestionQueue;
  let mockOrchestrator: SourceIngestionOrchestrator;
  let worker: IngestionWorker;

  beforeEach(() => {
    mockQueue = {
      popJob: vi.fn(),
      enqueueJob: vi.fn(),
    } as unknown as IngestionQueue;

    mockOrchestrator = {
      ingestSource: vi.fn(),
    } as unknown as SourceIngestionOrchestrator;

    worker = new IngestionWorker(mockQueue, mockOrchestrator);
  });

  it('should pop and process next job successfully', async () => {
    const testJob: IngestionJobData = {
      jobId: 'job-123',
      sourceId: 'src-123',
      notebookId: 'nb-123',
      userId: 'user-123',
    };

    vi.mocked(mockQueue.popJob).mockResolvedValueOnce(testJob);
    vi.mocked(mockOrchestrator.ingestSource).mockResolvedValueOnce({
      success: true,
      processedChunks: 5,
    });

    const processed = await worker.processNextJob();

    expect(processed).toBe(true);
    expect(mockQueue.popJob).toHaveBeenCalledTimes(1);
    expect(mockOrchestrator.ingestSource).toHaveBeenCalledWith(
      'src-123',
      'nb-123',
      'user-123',
      'job-123',
    );
  });

  it('should return false when queue is empty', async () => {
    vi.mocked(mockQueue.popJob).mockResolvedValueOnce(null);

    const processed = await worker.processNextJob();

    expect(processed).toBe(false);
    expect(mockOrchestrator.ingestSource).not.toHaveBeenCalled();
  });
});
