import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionWorker } from '@/workers/IngestionWorker';
import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';
import { SourceStatus } from '@prisma/client';

describe('IngestionWorker', () => {
  let worker: IngestionWorker;
  let queue: IngestionQueue;
  let mockOrchestrator: any;

  beforeEach(async () => {
    queue = new IngestionQueue();
    await queue.clear();

    mockOrchestrator = {
      ingestSource: vi.fn().mockResolvedValue({
        sourceId: 'src-1',
        notebookId: 'nb-1',
        status: SourceStatus.Indexed,
        chunksCount: 2,
        embeddingsCount: 2,
        durationMs: 50,
        success: true,
      }),
    };

    worker = new IngestionWorker(queue, mockOrchestrator);
  });

  it('should process enqueued job successfully', async () => {
    await queue.enqueueJob({
      sourceId: 'src-1',
      notebookId: 'nb-1',
      userId: 'user-1',
    });

    const processed = await worker.processNextJob();
    expect(processed).toBe(true);
    expect(mockOrchestrator.ingestSource).toHaveBeenCalledWith('src-1', 'nb-1', 'user-1', expect.any(String));
  });

  it('should return false when queue is empty', async () => {
    const processed = await worker.processNextJob();
    expect(processed).toBe(false);
    expect(mockOrchestrator.ingestSource).not.toHaveBeenCalled();
  });
});
