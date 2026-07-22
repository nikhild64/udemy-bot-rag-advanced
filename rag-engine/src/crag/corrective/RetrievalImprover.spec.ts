import { describe, it, expect, vi } from 'vitest';
import { RetrievalImprover } from './RetrievalImprover';
import { INotebookRetriever } from '../../retrieval/notebook/INotebookRetriever';
import { NotebookRetrievedChunk } from '../../retrieval/notebook/NotebookRetrievalResult';

describe('RetrievalImprover Unit Tests', () => {
  const mockRetriever: INotebookRetriever = {
    retrieve: vi.fn().mockResolvedValue([
      {
        chunkId: 'c_retry_1',
        text: 'Corrected retrieval context details about Expo router navigation.',
        score: 0.88,
        notebookId: 'nb_1',
        sourceId: 'src_1',
        sourceName: 'expo.md',
        sourceType: 'MARKDOWN',
        metadata: {},
      },
    ]),
  };

  const improver = new RetrievalImprover(mockRetriever);

  it('should execute corrective retrieval and return new candidates with actionTaken', async () => {
    const outcome = await improver.executeCorrectiveRetrieval({
      notebookId: 'nb_1',
      userId: 'user_1',
      query: 'expo router',
      attemptCount: 0,
      topK: 5,
    });

    expect(outcome.chunks.length).toBe(1);
    expect(outcome.chunks[0]?.chunkId).toBe('c_retry_1');
    expect(outcome.actionTaken).toContain('Rewrote query');
    expect(outcome.newTopK).toBeGreaterThan(5);
    expect(mockRetriever.retrieve).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ notebookId: 'nb_1', userId: 'user_1' })
    );
  });

  it('should deduplicate chunks by chunkId and text content when merging', () => {
    const existing: NotebookRetrievedChunk[] = [
      {
        chunkId: 'c1',
        text: 'Duplicate text chunk content.',
        score: 0.7,
        notebookId: 'nb_1',
        sourceId: 'src_1',
        sourceName: 'doc1.pdf',
        sourceType: 'PDF',
        metadata: {},
      },
    ];

    const incoming: NotebookRetrievedChunk[] = [
      {
        chunkId: 'c1', // Same ID
        text: 'Duplicate text chunk content.',
        score: 0.9,
        notebookId: 'nb_1',
        sourceId: 'src_1',
        sourceName: 'doc1.pdf',
        sourceType: 'PDF',
        metadata: {},
      },
      {
        chunkId: 'c2', // New ID
        text: 'Fresh distinct text content from retry attempt.',
        score: 0.85,
        notebookId: 'nb_1',
        sourceId: 'src_2',
        sourceName: 'doc2.pdf',
        sourceType: 'PDF',
        metadata: {},
      },
    ];

    const merged = improver.mergeAndDeduplicateChunks(existing, incoming);
    expect(merged.length).toBe(2);
    expect(merged.map((m) => m.chunkId)).toEqual(['c2', 'c1']); // Sorted descending by score
  });
});
