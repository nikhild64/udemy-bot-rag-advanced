import { describe, it, expect, vi } from 'vitest';
import { DenseNotebookRetriever } from './DenseNotebookRetriever';
import { EmbeddingProvider } from '@/core/contracts/embedding-provider.contract';
import { VectorStore } from '@/core/contracts/vector-store.contract';

describe('DenseNotebookRetriever', () => {
  it('should embed query and search vector store using notebookId filter', async () => {
    const mockEmbeddingProvider: EmbeddingProvider = {
      embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
      embedSingle: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };

    const mockSearchResults = [
      {
        score: 0.85,
        chunk: {
          id: 'chunk_1',
          text: 'RAG overview content',
          metadata: {
            notebookId: 'nb_123',
            sourceId: 'src_456',
            sourceTitle: 'RAG Guide',
            sourceType: 'pdf',
            page: 2,
          },
        },
      },
      {
        score: 0.4,
        chunk: {
          id: 'chunk_2',
          text: 'Low relevance text',
          metadata: {
            notebookId: 'nb_123',
            sourceId: 'src_789',
            sourceTitle: 'Random Notes',
            sourceType: 'txt',
          },
        },
      },
    ];

    const mockVectorStore: VectorStore = {
      search: vi.fn().mockResolvedValue(mockSearchResults),
      createCollection: vi.fn(),
      deleteCollection: vi.fn(),
      collectionExists: vi.fn(),
      getCollectionInfo: vi.fn(),
      validateCollection: vi.fn(),
      upsert: vi.fn(),
      deleteVectors: vi.fn(),
    };

    const retriever = new DenseNotebookRetriever(mockEmbeddingProvider, mockVectorStore);

    const results = await retriever.retrieve('what is RAG?', {
      notebookId: 'nb_123',
      userId: 'user_1',
      query: 'what is RAG?',
      similarityThreshold: 0.5,
    });

    expect(mockEmbeddingProvider.embedSingle).toHaveBeenCalledWith('what is RAG?');
    expect(mockVectorStore.search).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      20,
      expect.any(String),
      expect.objectContaining({ notebookId: 'nb_123' }),
    );

    // Only chunk_1 has score >= 0.5
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chunkId: 'chunk_1',
      text: 'RAG overview content',
      score: 0.85,
      notebookId: 'nb_123',
      sourceId: 'src_456',
      sourceName: 'RAG Guide',
      sourceType: 'pdf',
      page: 2,
    });
  });

  it('should throw an error if notebookId is missing', async () => {
    const retriever = new DenseNotebookRetriever({} as any, {} as any);
    await expect(
      retriever.retrieve('query', { notebookId: '', userId: 'u1', query: 'query' }),
    ).rejects.toThrow('notebookId is required');
  });
});
