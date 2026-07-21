import { Chunk, EmbeddedChunk } from '@/core/models';
import { EmbeddingProvider } from '@/providers/embeddings/EmbeddingProvider';
import { EmbeddingProviderFactory } from '@/providers/embeddings/EmbeddingProviderFactory';
import { IEmbeddingValidator, EmbeddingValidator } from './EmbeddingValidator';
import { EmbeddingResult } from './EmbeddingResult';
import { ChunkingResult } from '@/ingestion/chunking';
import { logger } from '@/shared/logger';
import { config } from '@/config';

export interface IEmbeddingService {
  /**
   * Generates embeddings for an array of Chunk domain models.
   */
  embedChunks(
    chunks: readonly Chunk[],
    options?: { courseId?: string; courseName?: string },
  ): Promise<EmbeddingResult>;

  /**
   * Generates embeddings for a ChunkingResult produced by Phase 7.
   */
  embedChunkingResult(chunkingResult: ChunkingResult): Promise<EmbeddingResult>;
}

export class EmbeddingService implements IEmbeddingService {
  private _provider: EmbeddingProvider | undefined;
  private readonly validator: IEmbeddingValidator;
  private readonly batchSize: number;

  constructor(
    provider?: EmbeddingProvider,
    validator?: IEmbeddingValidator,
    batchSize?: number,
  ) {
    this._provider = provider;
    this.validator = validator ?? new EmbeddingValidator();
    this.batchSize = batchSize ?? config.embeddings.batchSize ?? 50;
  }

  private getProvider(): EmbeddingProvider {
    if (!this._provider) {
      this._provider = EmbeddingProviderFactory.create();
    }
    return this._provider;
  }

  async embedChunks(
    chunks: readonly Chunk[],
    options?: { courseId?: string; courseName?: string },
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const courseId =
      options?.courseId ??
      (chunks[0]?.courseId || chunks[0]?.metadata?.courseId || 'unknown');
    const courseName = options?.courseName ?? courseId;
    const provider = this.getProvider();
    const providerName = provider.providerName ?? 'Mistral';
    const embeddingModel = provider.modelName ?? config.embeddings.mistralEmbeddingModel;
    const expectedDimension = provider.dimension;

    logger.info(
      { courseId, chunksCount: chunks.length, provider: providerName },
      'Embedding generation started',
    );
    logger.info({ provider: providerName, model: embeddingModel }, 'Provider selected');

    if (chunks.length === 0) {
      logger.info({ courseId }, 'No chunks provided to embed; returning empty embedding result');
      return {
        courseId,
        courseName,
        providerName,
        embeddingModel,
        chunksCount: 0,
        embeddingsGeneratedCount: 0,
        failedChunksCount: 0,
        durationMs: Date.now() - startTime,
        success: true,
        embeddedChunks: [],
        errors: [],
      };
    }

    const embeddedChunks: EmbeddedChunk[] = [];
    const errors: string[] = [];
    let failedChunksCount = 0;

    // Split chunks into batches
    const batches: Chunk[][] = [];
    for (let i = 0; i < chunks.length; i += this.batchSize) {
      batches.push(chunks.slice(i, i + this.batchSize) as Chunk[]);
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex] ?? [];
      const validBatchChunks: Chunk[] = [];

      for (const chunk of batch) {
        const valRes = this.validator.validateChunkBeforeEmbed(chunk);
        if (!valRes.valid) {
          failedChunksCount++;
          for (const err of valRes.errors) {
            errors.push(err);
          }
        } else {
          validBatchChunks.push(chunk);
        }
      }

      if (validBatchChunks.length === 0) {
        continue;
      }

      const texts = validBatchChunks.map((c) => c.text);
      try {
        const vectors = await provider.embed(texts);

        for (let i = 0; i < validBatchChunks.length; i++) {
          const chunk = validBatchChunks[i]!;
          const vector = vectors[i];

          const vecValRes = this.validator.validateEmbeddingVector(chunk, vector, expectedDimension);
          if (!vecValRes.valid) {
            failedChunksCount++;
            for (const err of vecValRes.errors) {
              errors.push(err);
            }
          } else if (vector) {
            const embeddedChunk: EmbeddedChunk = {
              ...chunk,
              embedding: vector,
              embeddingModel,
              embeddingDimension: vector.length,
              providerName,
              provider: providerName,
            };
            embeddedChunks.push(embeddedChunk);
          }
        }

        logger.info(
          { courseId, batchIndex: batchIndex + 1, totalBatches: batches.length, batchSize: validBatchChunks.length },
          'Batch processed',
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          { courseId, batchIndex: batchIndex + 1, err: errorMessage },
          'Batch embedding generation failed',
        );
        failedChunksCount += validBatchChunks.length;
        errors.push(`Batch ${batchIndex + 1} failed: ${errorMessage}`);
      }
    }

    const durationMs = Date.now() - startTime;
    const success = failedChunksCount === 0 && errors.length === 0;

    logger.info(
      {
        courseId,
        totalEmbeddingsGenerated: embeddedChunks.length,
        failedChunksCount,
        durationMs,
        success,
      },
      'Total embeddings generated',
    );

    return {
      courseId,
      courseName,
      providerName,
      embeddingModel,
      chunksCount: chunks.length,
      embeddingsGeneratedCount: embeddedChunks.length,
      failedChunksCount,
      durationMs,
      success,
      embeddedChunks,
      errors,
    };
  }

  async embedChunkingResult(chunkingResult: ChunkingResult): Promise<EmbeddingResult> {
    const providerName = this._provider?.providerName ?? 'unknown';
    const embeddingModel = this._provider?.modelName ?? config.embeddings?.mistralEmbeddingModel ?? 'mistral-embed';

    if (!chunkingResult.success || !chunkingResult.chunks || chunkingResult.chunks.length === 0) {
      logger.warn(
        { courseId: chunkingResult.courseId },
        'Skipping embedding generation for chunking result with errors or 0 chunks',
      );
      return {
        courseId: chunkingResult.courseId,
        courseName: chunkingResult.courseName,
        providerName,
        embeddingModel,
        chunksCount: chunkingResult.totalChunksCount,
        embeddingsGeneratedCount: 0,
        failedChunksCount: chunkingResult.totalChunksCount,
        durationMs: 0,
        success: chunkingResult.success,
        embeddedChunks: [],
        errors: chunkingResult.errors,
      };
    }

    return this.embedChunks(chunkingResult.chunks, {
      courseId: chunkingResult.courseId,
      courseName: chunkingResult.courseName,
    });
  }
}
