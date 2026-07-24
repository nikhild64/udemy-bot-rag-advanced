import { INotebookRetriever } from './INotebookRetriever';
import { NotebookRetrievalOptions, NotebookRetrievedChunk } from './NotebookRetrievalResult';
import { EmbeddingProvider } from '@/core/contracts/embedding-provider.contract';
import { VectorStore } from '@/core/contracts/vector-store.contract';
import { EmbeddingProviderFactory } from '@/providers/embeddings/EmbeddingProviderFactory';
import { VectorStoreFactory } from '@/providers/vectorstore/VectorStoreFactory';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { AppError } from '@/shared/errors';

export class DenseNotebookRetriever implements INotebookRetriever {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly vectorStore: VectorStore;

  constructor(
    embeddingProvider?: EmbeddingProvider,
    vectorStore?: VectorStore,
  ) {
    this.embeddingProvider = embeddingProvider ?? EmbeddingProviderFactory.create();
    this.vectorStore = vectorStore ?? VectorStoreFactory.create();
  }

  async retrieve(
    query: string,
    options: NotebookRetrievalOptions,
  ): Promise<NotebookRetrievedChunk[]> {
    if (!options.notebookId) {
      throw new AppError('notebookId is required for notebook retrieval', { statusCode: 400 });
    }

    const limit = options.candidateLimit ?? options.topK ?? 20;
    const similarityThreshold = options.similarityThreshold ?? 0.0;

    // 1. Generate query embedding
    let queryEmbedding: number[] = [];
    try {
      if (this.embeddingProvider.embedSingle) {
        queryEmbedding = (await this.embeddingProvider.embedSingle(query))!;
      } else {
        const embeddings = await this.embeddingProvider.embed([query]);
        queryEmbedding = embeddings[0]!;
      }
    } catch (error) {
      logger.error({ err: error, notebookId: options.notebookId }, 'Failed to generate query embedding for notebook retrieval');
      throw new AppError('Embedding generation failed during retrieval', { statusCode: 500, cause: error });
    }

    // 2. Build tenant-isolated search filter (MUST include notebookId)
    const searchFilters: Record<string, unknown> = {
      notebookId: options.notebookId,
      ...(options.filters ?? {}),
    };

    const collectionName = config.vectorStore.userKnowledgeCollection ?? config.vectorStore.collectionName;

    // 3. Search vector store
    let searchResults;
    try {
      searchResults = await this.vectorStore.search(
        queryEmbedding,
        limit,
        collectionName,
        searchFilters,
      );
    } catch (error) {
      logger.error({ err: error, notebookId: options.notebookId }, 'Vector store search failed for notebook retrieval');
      throw new AppError('Vector search failed during notebook retrieval', { statusCode: 500, cause: error });
    }

    // 4. Filter by similarity threshold & map to NotebookRetrievedChunk
    const candidateChunks: NotebookRetrievedChunk[] = searchResults
      .filter((res) => res.score >= similarityThreshold)
      .map((res) => {
        const meta = (res.chunk.metadata ?? {}) as Record<string, unknown>;
        const sourceId = (meta.sourceId as string) || (res.chunk.lessonId as string) || 'unknown-source';
        const sourceName = (meta.sourceTitle as string) || (meta.displayName as string) || (meta.title as string) || 'Untitled Source';
        const sourceType = (meta.sourceType as string) || 'document';
        const page = typeof meta.page === 'number'
          ? meta.page
          : typeof meta.pageNumber === 'number'
            ? meta.pageNumber
            : null;
        const timestamp = typeof meta.timestamp === 'number' ? meta.timestamp : null;

        return {
          chunkId: res.chunk.id,
          text: res.chunk.text,
          score: res.score,
          originalScore: res.score,
          notebookId: options.notebookId,
          sourceId,
          sourceName,
          sourceType,
          page,
          timestamp,
          metadata: meta,
        };
      });

    logger.debug(
      { notebookId: options.notebookId, totalFound: searchResults.length, acceptedCandidates: candidateChunks.length },
      'Dense notebook retrieval completed',
    );

    return candidateChunks;
  }
}
