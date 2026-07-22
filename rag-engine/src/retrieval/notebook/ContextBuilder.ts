import { NotebookRetrievedChunk } from './NotebookRetrievalResult';
import { logger } from '@/shared/logger';

export class ContextBuilder {
  /**
   * Estimates token count for a string using standard RAG heuristic (~4 characters per token).
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Formats a single chunk with source metadata header.
   */
  private static formatChunk(chunk: NotebookRetrievedChunk, index: number): string {
    const metaParts: string[] = [`Source: ${chunk.sourceName}`];
    if (chunk.sourceType) {
      metaParts.push(`Type: ${chunk.sourceType}`);
    }
    if (chunk.page !== null && chunk.page !== undefined) {
      metaParts.push(`Page: ${chunk.page}`);
    }
    if (chunk.timestamp !== null && chunk.timestamp !== undefined) {
      metaParts.push(`Timestamp: ${chunk.timestamp}s`);
    }

    const header = `--- Document Chunk [${index + 1}] (${metaParts.join(' | ')}) ---`;
    return `${header}\n${chunk.text.trim()}`;
  }

  /**
   * Builds an AI-ready context string from a ranked list of candidate chunks.
   * Performs deduplication and respects maximum token budget.
   */
  public static buildContext(
    chunks: readonly NotebookRetrievedChunk[],
    maxTokens: number = 4000,
  ): { context: string; includedChunks: NotebookRetrievedChunk[] } {
    if (!chunks || chunks.length === 0) {
      return { context: '', includedChunks: [] };
    }

    const seenTexts = new Set<string>();
    const includedChunks: NotebookRetrievedChunk[] = [];
    const formattedBlocks: string[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      const normalizedText = chunk.text.trim().toLowerCase();
      
      // Deduplicate identical content
      if (seenTexts.has(normalizedText)) {
        continue;
      }
      seenTexts.add(normalizedText);

      const formattedBlock = this.formatChunk(chunk, includedChunks.length);
      const blockTokens = this.estimateTokens(formattedBlock);

      if (currentTokens + blockTokens > maxTokens && includedChunks.length > 0) {
        logger.debug(
          { currentTokens, blockTokens, maxTokens, includedCount: includedChunks.length },
          'Context token budget reached, stopping chunk inclusion',
        );
        break;
      }

      includedChunks.push(chunk);
      formattedBlocks.push(formattedBlock);
      currentTokens += blockTokens;
    }

    const context = formattedBlocks.join('\n\n');
    return { context, includedChunks };
  }
}
