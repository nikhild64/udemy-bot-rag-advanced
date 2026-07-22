import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { Citation } from '../../retrieval/Citation';
import { config } from '../../config';
import { logger } from '../../shared/logger';

export interface ContextFilterOptions {
  readonly minChunkConfidence?: number;
  readonly maxContextSizeChars?: number;
  readonly maxChunks?: number;
}

export interface FilteredContextResult {
  readonly chunks: RetrievedChunk[];
  readonly citations: Citation[];
  readonly documentsAccepted: number;
  readonly documentsDiscarded: number;
}

export class ContextFilterService {
  constructor(private readonly minChunkConfidence: number = config.crag.minChunkConfidence) {}

  public filter(chunks: RetrievedChunk[], options?: ContextFilterOptions): FilteredContextResult {
    const minConfidence = options?.minChunkConfidence ?? this.minChunkConfidence;
    const maxChars = options?.maxContextSizeChars ?? 20000;
    const maxChunks = options?.maxChunks;

    const seenChunkIds = new Set<string>();
    const seenTextHashes = new Set<string>();

    const filteredChunks: RetrievedChunk[] = [];
    let currentChars = 0;
    let discardedCount = 0;

    for (const chunk of chunks) {
      // 1. Confidence threshold check
      if (typeof chunk.score === 'number' && chunk.score < minConfidence) {
        discardedCount++;
        continue;
      }

      // 2. Duplicate chunkId check
      if (chunk.chunkId && seenChunkIds.has(chunk.chunkId)) {
        discardedCount++;
        continue;
      }

      // 3. Duplicate text check (normalized whitespace)
      const textHash = (chunk.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenTextHashes.has(textHash)) {
        discardedCount++;
        continue;
      }

      // 4. Max chunks cap
      if (maxChunks !== undefined && filteredChunks.length >= maxChunks) {
        discardedCount++;
        continue;
      }

      // 5. Max context character budget check
      const chunkLength = (chunk.text || '').length;
      if (currentChars + chunkLength > maxChars && filteredChunks.length > 0) {
        discardedCount++;
        continue;
      }

      // Accepted chunk
      if (chunk.chunkId) seenChunkIds.add(chunk.chunkId);
      if (textHash) seenTextHashes.add(textHash);
      filteredChunks.push(chunk);
      currentChars += chunkLength;
    }

    // Extract corresponding citations preserving order & attribution
    const citations: Citation[] = filteredChunks
      .map(c => c.citation)
      .filter((cit): cit is Citation => Boolean(cit));

    logger.debug(
      {
        totalInput: chunks.length,
        documentsAccepted: filteredChunks.length,
        documentsDiscarded: discardedCount,
        minConfidence,
      },
      'ContextFilterService completed'
    );

    return {
      chunks: filteredChunks,
      citations,
      documentsAccepted: filteredChunks.length,
      documentsDiscarded: discardedCount,
    };
  }
}
