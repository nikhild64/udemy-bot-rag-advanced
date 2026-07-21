import { logger } from '@/shared/logger';
import { ChatProvider, RerankerProvider } from '@/core/contracts';
import { RerankRequest, RerankResult } from '@/core/models';
import { retrievalConfig } from '@/config/retrieval';

export class LLMRerankerProvider<T = unknown> implements RerankerProvider<T> {
  private readonly topK: number;
  private readonly batchSize: number;

  constructor(
    private readonly chatProvider: ChatProvider,
    options?: { topK?: number; batchSize?: number }
  ) {
    this.topK = options?.topK ?? retrievalConfig.rerankerTopK;
    this.batchSize = options?.batchSize ?? retrievalConfig.rerankerBatchSize;
  }

  public async rerank(request: RerankRequest<T>): Promise<RerankResult<T>> {
    const { query, chunks } = request;
    if (!chunks.length) {
      return {
        query,
        originalCount: 0,
        rerankedCount: 0,
        chunks: [],
        provider: 'llm',
      };
    }

    logger.debug(
      { query, chunkCount: chunks.length, topK: this.topK, batchSize: this.batchSize },
      'LLM Reranking started'
    );
    logger.debug({ providerName: 'llm' }, 'Chat Provider used');

    try {
      const allScores: Map<string, number> = new Map();
      const batches = Math.ceil(chunks.length / this.batchSize);
      logger.debug({ batches, batchSize: this.batchSize }, 'Batch count');

      for (let i = 0; i < chunks.length; i += this.batchSize) {
        const batch = chunks.slice(i, i + this.batchSize);
        const batchScores = await this.processBatch(query, batch);
        
        if (!batchScores) {
          throw new Error('Batch processing failed');
        }
        
        for (const [id, score] of batchScores.entries()) {
          allScores.set(id, score);
        }
      }

      // Sort by score descending
      const sortedChunks = [...chunks].sort((a, b) => {
        const idA = this.getChunkId(a);
        const idB = this.getChunkId(b);
        const scoreA = allScores.get(idA) ?? 0;
        const scoreB = allScores.get(idB) ?? 0;
        return scoreB - scoreA;
      });

      logger.debug('Sorting completed');

      const topChunks = sortedChunks.slice(0, this.topK);
      logger.debug({ returnedCount: topChunks.length }, 'Top K returned');

      return {
        query,
        originalCount: chunks.length,
        rerankedCount: topChunks.length,
        chunks: topChunks,
        provider: 'llm',
      };
    } catch (error) {
      logger.error({ err: error }, 'LLM Reranking failed, falling back to original order');
      return {
        query,
        originalCount: chunks.length,
        rerankedCount: Math.min(chunks.length, this.topK),
        chunks: chunks.slice(0, this.topK),
        provider: 'llm',
      };
    }
  }

  private async processBatch(query: string, batch: T[]): Promise<Map<string, number> | null> {
    const prompt = this.buildPrompt(query, batch);
    logger.debug('Prompt generation completed');

    try {
      const response = await this.chatProvider.generateResponse([
        { role: 'user', content: prompt }
      ]);
      return this.parseAndValidate(response.message.content, batch);
    } catch (error) {
      logger.error({ err: error }, 'Chat provider failed during reranking batch');
      return null;
    }
  }

  private buildPrompt(query: string, batch: T[]): string {
    let prompt = `You are a retrieval reranker.

Given a search query and a collection of candidate passages, assign each passage a semantic relevance score between 0.0 and 1.0.

Do NOT answer the question.
Do NOT summarize.
Do NOT explain your reasoning.
Return ONLY valid JSON.

Example response:
[
  {
    "chunkId": "chunk-1",
    "score": 0.96
  },
  {
    "chunkId": "chunk-2",
    "score": 0.81
  }
]

Question
${query}

Candidate Passages
`;

    for (const item of batch) {
      const id = this.getChunkId(item);
      const text = this.getChunkText(item);
      prompt += `\nChunk ID:\n${id}\n\nContent:\n${text}\n\n--------------------\n`;
    }

    return prompt;
  }

  private parseAndValidate(content: string, batch: T[]): Map<string, number> | null {
    try {
      const cleaned = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        logger.error('Reranker response is not a JSON array');
        return null;
      }

      const batchIds = new Set(batch.map(item => this.getChunkId(item)));
      const scores = new Map<string, number>();

      for (const item of parsed) {
        if (!item || typeof item !== 'object') {
          logger.error('Invalid item in reranker response');
          return null;
        }
        
        if (typeof item.chunkId !== 'string' || typeof item.score !== 'number') {
          logger.error('Invalid chunkId or score format in reranker response');
          return null;
        }

        if (item.score < 0 || item.score > 1) {
          logger.error(`Invalid score value (must be between 0 and 1): ${item.score}`);
          return null;
        }

        if (!batchIds.has(item.chunkId)) {
          logger.error(`Unknown chunk ID in response: ${item.chunkId}`);
          return null;
        }

        if (scores.has(item.chunkId)) {
          logger.error(`Duplicate chunk ID in response: ${item.chunkId}`);
          return null;
        }
        
        scores.set(item.chunkId, item.score);
      }

      // Check for missing chunk IDs
      if (scores.size !== batchIds.size) {
        logger.error('Missing chunk ID in response');
        return null;
      }

      logger.debug('Response validation completed');
      return scores;
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse reranker JSON response');
      return null;
    }
  }

  private getChunkId(item: T): string {
    const record = item as Record<string, unknown>;
    const chunk = record?.chunk as Record<string, unknown> | undefined;
    return String(chunk?.id ?? record?.id ?? 'unknown');
  }

  private getChunkText(item: T): string {
    const record = item as Record<string, unknown>;
    const chunk = record?.chunk as Record<string, unknown> | undefined;
    return String(chunk?.text ?? record?.text ?? '');
  }
}
