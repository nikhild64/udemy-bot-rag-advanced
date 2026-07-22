import { describe, it, expect, beforeEach } from 'vitest';
import { IngestionQueue } from '@/infrastructure/queue/IngestionQueue';

describe('IngestionQueue', () => {
  let queue: IngestionQueue;

  beforeEach(async () => {
    queue = new IngestionQueue();
    await queue.clear();
  });

  it('should enqueue a new job and return initial progress status', async () => {
    const progress = await queue.enqueueJob({
      sourceId: 'src-123',
      notebookId: 'nb-456',
      userId: 'user-789',
      storagePath: 'uploads/test.txt',
    });

    expect(progress).toBeDefined();
    expect(progress.sourceId).toBe('src-123');
    expect(progress.notebookId).toBe('nb-456');
    expect(progress.status).toBe('Queued');
    expect(progress.currentStage).toBe('Queued');
    expect(progress.progress).toBe(0);
  });

  it('should pop enqueued job in FIFO order', async () => {
    await queue.enqueueJob({
      sourceId: 'src-1',
      notebookId: 'nb-1',
      userId: 'user-1',
    });
    await queue.enqueueJob({
      sourceId: 'src-2',
      notebookId: 'nb-2',
      userId: 'user-2',
    });

    const job1 = await queue.popJob();
    expect(job1).toBeDefined();
    expect(job1?.sourceId).toBe('src-1');

    const job2 = await queue.popJob();
    expect(job2).toBeDefined();
    expect(job2?.sourceId).toBe('src-2');

    const job3 = await queue.popJob();
    expect(job3).toBeNull();
  });

  it('should update job progress and retrieve it by sourceId', async () => {
    await queue.enqueueJob({
      sourceId: 'src-100',
      notebookId: 'nb-200',
      userId: 'user-300',
    });

    const updated = await queue.updateProgress('src-100', 'Embedding', 75, 'Processing');
    expect(updated).toBeDefined();
    expect(updated?.currentStage).toBe('Embedding');
    expect(updated?.progress).toBe(75);
    expect(updated?.status).toBe('Processing');

    const fetched = await queue.getJobStatus('src-100');
    expect(fetched).toBeDefined();
    expect(fetched?.currentStage).toBe('Embedding');
    expect(fetched?.progress).toBe(75);
  });
});
