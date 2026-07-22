import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetrievalOrchestrator } from './RetrievalOrchestrator';
import { NotebookService } from '@/services/NotebookService';
import { QueryTransformationService } from '@/query/services/query-transformation.service';
import { INotebookRetriever } from './INotebookRetriever';
import { RerankingService } from '@/reranking/RerankingService';
import { NotebookRetrievedChunk } from './NotebookRetrievalResult';
import { NotFoundError } from '@/shared/errors';

describe('RetrievalOrchestrator', () => {
  let mockNotebookService: NotebookService;
  let mockQueryTransformationService: QueryTransformationService;
  let mockRetriever: INotebookRetriever;
  let mockRerankingService: RerankingService;
  let orchestrator: RetrievalOrchestrator;

  const sampleChunk: NotebookRetrievedChunk = {
    chunkId: 'chunk_1',
    text: 'Dense vector search chunk text for tests.',
    score: 0.88,
    notebookId: 'nb_1',
    sourceId: 'src_1',
    sourceName: 'Test Document',
    sourceType: 'pdf',
    page: 1,
    metadata: {},
  };

  beforeEach(() => {
    mockNotebookService = {
      getNotebook: vi.fn().mockResolvedValue({ id: 'nb_1', userId: 'user_1', title: 'Test Notebook' }),
    } as unknown as NotebookService;

    mockQueryTransformationService = {
      transform: vi.fn().mockResolvedValue({
        originalQuery: 'what is AI?',
        transformedQuery: 'explain artificial intelligence principles',
        transformedQueries: ['explain artificial intelligence principles'],
        strategy: 'Rewrite',
        metadata: {},
      }),
    } as unknown as QueryTransformationService;

    mockRetriever = {
      retrieve: vi.fn().mockResolvedValue([sampleChunk]),
    };

    mockRerankingService = {
      rerank: vi.fn().mockResolvedValue({
        query: 'explain artificial intelligence principles',
        originalCount: 1,
        rerankedCount: 1,
        chunks: [sampleChunk],
        provider: 'mock-reranker',
      }),
    } as unknown as RerankingService;

    orchestrator = new RetrievalOrchestrator(
      mockNotebookService,
      mockQueryTransformationService,
      mockRetriever,
      mockRerankingService,
    );
  });

  it('should execute complete notebook retrieval orchestration workflow', async () => {
    const options = {
      notebookId: 'nb_1',
      userId: 'user_1',
      query: 'what is AI?',
      topK: 5,
    };

    const result = await orchestrator.retrieve(options);

    expect(mockNotebookService.getNotebook).toHaveBeenCalledWith('nb_1', 'user_1');
    expect(mockQueryTransformationService.transform).toHaveBeenCalledWith('what is AI?');
    expect(mockRetriever.retrieve).toHaveBeenCalledWith('explain artificial intelligence principles', options);
    expect(mockRerankingService.rerank).toHaveBeenCalledWith('explain artificial intelligence principles', [sampleChunk]);

    expect(result.context).toContain('Dense vector search chunk text for tests.');
    expect(result.chunks).toHaveLength(1);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.sourceName).toBe('Test Document');

    expect(result.metadata).toMatchObject({
      notebookId: 'nb_1',
      originalQuery: 'what is AI?',
      transformedQuery: 'explain artificial intelligence principles',
      candidateCount: 1,
      finalChunkCount: 1,
      citationCount: 1,
    });
    expect(result.metadata.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should throw error if notebook validation fails', async () => {
    (mockNotebookService.getNotebook as any).mockRejectedValueOnce(new NotFoundError('Notebook not found'));

    await expect(
      orchestrator.retrieve({ notebookId: 'nb_missing', userId: 'user_1', query: 'test' }),
    ).rejects.toThrow('Notebook not found');

    expect(mockRetriever.retrieve).not.toHaveBeenCalled();
  });

  it('should fallback gracefully if query transformation fails', async () => {
    (mockQueryTransformationService.transform as any).mockRejectedValueOnce(new Error('Transformation error'));

    const result = await orchestrator.retrieve({
      notebookId: 'nb_1',
      userId: 'user_1',
      query: 'what is AI?',
    });

    expect(mockRetriever.retrieve).toHaveBeenCalledWith('what is AI?', expect.anything());
    expect(result.chunks).toHaveLength(1);
  });
});
