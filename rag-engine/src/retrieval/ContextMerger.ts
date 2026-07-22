import { RetrievalResult, RetrievedChunk } from './RetrievalResult';

export class ContextMerger {
  /**
   * Merges multiple RetrievalResult objects from multi-query searches.
   * Deduplicates by chunkId, keeps highest score for duplicates, preserves citations,
   * and respects the overall topK limit.
   */
  public static mergeResults(
    results: RetrievalResult[],
    primaryQuery: string,
    topK?: number
  ): RetrievalResult {
    if (!results || results.length === 0) {
      return {
        query: primaryQuery,
        retrievedChunks: [],
        citations: [],
        totalResults: 0,
        elapsedTime: 0,
        statistics: {
          searchDurationMs: 0,
          embeddingDurationMs: 0,
          retrievedChunksCount: 0,
          appliedFilters: null,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
        },
      };
    }

    if (results.length === 1) {
      const single = results[0]!;
      if (topK && single.retrievedChunks.length > topK) {
        const slicedChunks = single.retrievedChunks.slice(0, topK);
        return {
          ...single,
          retrievedChunks: slicedChunks,
          citations: slicedChunks.map((c) => c.citation),
          totalResults: slicedChunks.length,
        };
      }
      return single;
    }

    // Map chunkId -> best RetrievedChunk
    const chunkMap = new Map<string, RetrievedChunk>();
    let totalSearchMs = 0;
    let totalEmbedMs = 0;
    let maxElapsedTime = 0;
    let appliedFilters: Record<string, unknown> | null = null;

    for (const result of results) {
      if (result.elapsedTime > maxElapsedTime) {
        maxElapsedTime = result.elapsedTime;
      }
      totalSearchMs += result.statistics.searchDurationMs;
      totalEmbedMs += result.statistics.embeddingDurationMs;
      if (!appliedFilters && result.statistics.appliedFilters) {
        appliedFilters = result.statistics.appliedFilters;
      }

      for (const chunk of result.retrievedChunks) {
        const id = chunk.chunkId;
        const existing = chunkMap.get(id);

        if (!existing || chunk.score > existing.score) {
          chunkMap.set(id, chunk);
        }
      }
    }

    // Sort deduplicated chunks by score descending
    const mergedChunks = Array.from(chunkMap.values()).sort(
      (a, b) => b.score - a.score
    );

    // Apply topK limit
    const finalChunks = topK ? mergedChunks.slice(0, topK) : mergedChunks;
    const citations = finalChunks.map((c) => c.citation);
    const scores = finalChunks.map((c) => c.score);

    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const averageScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    return {
      query: primaryQuery,
      retrievedChunks: finalChunks,
      citations,
      totalResults: finalChunks.length,
      elapsedTime: maxElapsedTime,
      statistics: {
        searchDurationMs: totalSearchMs,
        embeddingDurationMs: totalEmbedMs,
        retrievedChunksCount: finalChunks.length,
        appliedFilters,
        averageScore,
        highestScore,
        lowestScore,
      },
    };
  }
}
