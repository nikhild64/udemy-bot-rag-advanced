import { NotebookRetrievedChunk, Citation } from './NotebookRetrievalResult';

export class CitationBuilder {
  /**
   * Generates a concise snippet preview from chunk text.
   */
  private static createSnippet(text: string, maxLength: number = 150): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return `${cleaned.slice(0, maxLength - 3)}...`;
  }

  /**
   * Builds citation records for candidate chunks.
   */
  public static buildCitations(chunks: readonly NotebookRetrievedChunk[]): Citation[] {
    if (!chunks || chunks.length === 0) {
      return [];
    }

    return chunks.map((chunk) => {
      return {
        citationId: `cit_${chunk.chunkId}`,
        notebookId: chunk.notebookId,
        sourceId: chunk.sourceId,
        sourceName: chunk.sourceName,
        sourceType: chunk.sourceType,
        page: chunk.page ?? null,
        timestamp: chunk.timestamp ?? null,
        chunkId: chunk.chunkId,
        excerpt: chunk.text,
        snippet: this.createSnippet(chunk.text),
        similarityScore: chunk.score,
      };
    });
  }
}
