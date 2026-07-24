import { ChatRole } from '@/types';
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
      const response = await this.chatProvider.generateResponse(
        [{ role: ChatRole.USER, content: prompt }],
        { task: 'reranking' }
      );
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
    "chunkId": "idx-ref-0",
    "score": 0.96
  },
  {
    "chunkId": "idx-ref-1",
    "score": 0.81
  }
]

Question
${query}

Candidate Passages
`;

    for (let idx = 0; idx < batch.length; idx++) {
      const item = batch[idx];
      if (item !== undefined) {
        const text = this.getChunkText(item);
        prompt += `\nChunk ID:\nidx-ref-${idx}\n\nContent:\n${text}\n\n--------------------\n`;
      }
    }

    return prompt;
  }

  private parseAndValidate(content: string, batch: T[]): Map<string, number> | null {
    try {
      let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || cleaned.match(/(\[\s*\{[\s\S]*\}\s*\])/);
      if (jsonMatch && jsonMatch[1]) {
        cleaned = jsonMatch[1].trim();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        logger.error({ err: parseErr, rawContent: content.substring(0, 300) }, 'Failed to parse reranker JSON response');
        return null;
      }

      if (!Array.isArray(parsed)) {
        logger.error({ rawContent: content.substring(0, 300) }, 'Reranker response is not a JSON array');
        return null;
      }

      const scores = new Map<string, number>();

      for (let itemIdx = 0; itemIdx < parsed.length; itemIdx++) {
        const item = parsed[itemIdx];
        if (!item || typeof item !== 'object') {
          continue;
        }

        const rawChunkId = String(item.chunkId ?? item.id ?? item.index ?? itemIdx);
        let rawScore = Number(item.score ?? item.relevance_score ?? item.relevanceScore ?? 0);

        if (isNaN(rawScore)) {
          rawScore = 0;
        } else if (rawScore > 1 && rawScore <= 100) {
          rawScore = rawScore / 100;
        } else if (rawScore < 0) {
          rawScore = 0;
        } else if (rawScore > 1) {
          rawScore = 1;
        }

        let matchedId: string | undefined;

        // Try index-based ID (idx-ref-0 or number 0..batch.length)
        const match = rawChunkId.match(/^(?:idx-ref-)?(\d+)$/);
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx >= 0 && idx < batch.length && batch[idx] !== undefined) {
            matchedId = this.getChunkId(batch[idx]!);
          }
        }

        if (!matchedId) {
          const batchIds = new Set(batch.map((b) => this.getChunkId(b)));
          if (batchIds.has(rawChunkId)) {
            matchedId = rawChunkId;
          } else {
            const foundOriginal = Array.from(batchIds).find(
              (id) => id.startsWith(rawChunkId) || rawChunkId.startsWith(id),
            );
            if (foundOriginal) {
              matchedId = foundOriginal;
            }
          }
        }

        if (matchedId && !scores.has(matchedId)) {
          scores.set(matchedId, rawScore);
        }
      }

      // Ensure all batch items have a score (defaulting missing to 0)
      const batchIds = batch.map((item) => this.getChunkId(item));
      for (const id of batchIds) {
        if (!scores.has(id)) {
          scores.set(id, 0);
        }
      }

      logger.debug({ scoredCount: scores.size }, 'Response validation completed');
      return scores;
    } catch (error) {
      logger.error({ err: error }, 'Unexpected error during reranker response parsing');
      return null;
    }
  }

  private getChunkId(item: T): string {
    const record = item as Record<string, unknown>;
    const chunk = record?.chunk as Record<string, unknown> | undefined;
    return String(record?.chunkId ?? chunk?.id ?? record?.id ?? 'unknown');
  }

  private getChunkText(item: T): string {
    const record = item as Record<string, unknown>;
    const chunk = record?.chunk as Record<string, unknown> | undefined;
    return String(chunk?.text ?? record?.text ?? '');
  }
}
