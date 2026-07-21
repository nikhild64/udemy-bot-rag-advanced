import { performance } from 'node:perf_hooks';
import { logger } from '@/shared/logger';
import { EmbeddingProvider } from '@/core/contracts/embedding-provider.contract';
import { VectorStore } from '@/core/contracts/vector-store.contract';
import { SearchRequest, SearchRequestSchema } from './SearchRequest';
import { SearchResponse } from './SearchResponse';
import { RetrievedChunk, RetrievalResult } from './RetrievalResult';
import { AppError } from '@/shared/errors';

export class RetrievalService {
  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorStore: VectorStore
  ) {}

  public async search(request: SearchRequest): Promise<SearchResponse> {
    logger.info({ query: request.query }, 'Retrieval search started');
    const startTotal = performance.now();

    // 1. Validate request
    const parseResult = SearchRequestSchema.safeParse(request);
    if (!parseResult.success) {
      throw new AppError('Invalid search request', {
        statusCode: 400,
        metadata: { issues: parseResult.error.errors },
      });
    }
    const validatedRequest = parseResult.data;

    // 2. Generate embedding
    const startEmbedding = performance.now();
    let queryEmbedding: number[] = [];
    try {
      if (this.embeddingProvider.embedSingle) {
        queryEmbedding = (await this.embeddingProvider.embedSingle(validatedRequest.query))!;
      } else {
        const embeddings = await this.embeddingProvider.embed([validatedRequest.query]);
        queryEmbedding = embeddings[0]!;
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to generate query embedding');
      throw new AppError('Embedding generation failed', { statusCode: 500, cause: error });
    }
    const embeddingDurationMs = Math.round(performance.now() - startEmbedding);
    logger.debug({ durationMs: embeddingDurationMs }, 'Query embedding generated');

    // 3. Search vector store
    const startSearch = performance.now();
    let searchResults;
    try {
      searchResults = await this.vectorStore.search(
        queryEmbedding,
        validatedRequest.topK,
        undefined, // default collection
        validatedRequest.filters
      );
    } catch (error) {
      logger.error({ err: error }, 'Vector search failed');
      throw new AppError('Vector search failed', { statusCode: 500, cause: error });
    }
    const searchDurationMs = Math.round(performance.now() - startSearch);
    logger.debug({ durationMs: searchDurationMs, resultsCount: searchResults.length }, 'Vector search completed');

    // 4. Filter by minimum score and construct chunks
    const retrievedChunks: RetrievedChunk[] = searchResults
      .filter((result) => result.score >= validatedRequest.minimumScore)
      .map((result) => {
        const metadata = result.chunk.metadata;
        const sourceReference = {
          courseName: (metadata.courseName as string) || 'Unknown Course',
          moduleTitle: (metadata.moduleTitle as string) || 'Unknown Module',
          lessonTitle: (metadata.lessonTitle as string) || 'Unknown Lesson',
          transcriptFile: (metadata.sourceTranscriptPath as string) || 'unknown.vtt',
          startTime: (metadata.startTime as number) || 0,
          endTime: (metadata.endTime as number) || 0,
        };

        const citation = {
          chunkId: result.chunk.id,
          courseId: (metadata.courseId as string) || 'unknown-course',
          courseName: sourceReference.courseName,
          moduleId: (metadata.moduleId as string) || 'unknown-module',
          moduleTitle: sourceReference.moduleTitle,
          lessonId: (metadata.lessonId as string) || 'unknown-lesson',
          lessonTitle: sourceReference.lessonTitle,
          transcriptFile: sourceReference.transcriptFile,
          startTime: sourceReference.startTime,
          endTime: sourceReference.endTime,
          similarityScore: result.score,
        };

        return {
          chunkId: result.chunk.id,
          score: result.score,
          text: result.chunk.text,
          metadata: result.chunk.metadata,
          chunk: result.chunk,
          startTime: (metadata.startTime as number) || 0,
          endTime: (metadata.endTime as number) || 0,
          sourceReference,
          citation,
        };
      });

    // 5. Calculate statistics
    const scores = retrievedChunks.map((chunk) => chunk.score);
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    const elapsedTime = Math.round(performance.now() - startTotal);
    const citations = retrievedChunks.map(chunk => chunk.citation);

    const result: RetrievalResult = {
      query: validatedRequest.query,
      retrievedChunks,
      citations,
      totalResults: retrievedChunks.length,
      elapsedTime,
      statistics: {
        searchDurationMs,
        embeddingDurationMs,
        retrievedChunksCount: retrievedChunks.length,
        appliedFilters: validatedRequest.filters || null,
        averageScore,
        highestScore,
        lowestScore,
      }
    };

    logger.info(
      { 
        totalResults: result.totalResults, 
        elapsedTime,
        highestScore: result.statistics.highestScore 
      }, 
      'Retrieval completed successfully'
    );

    return result;
  }
}
