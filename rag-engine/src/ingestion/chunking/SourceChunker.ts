import { config } from '@/config';

export interface SourceChunkMetadata {
  page?: number | null;
  timestamp?: string | null;
  section?: string | null;
  heading?: string | null;
  startChar: number;
  endChar: number;
  [key: string]: any;
}

export interface SourceChunk {
  chunkId: string;
  sourceId: string;
  notebookId: string;
  chunkIndex: number;
  content: string;
  text: string;
  metadata: SourceChunkMetadata;
}

export class SourceChunker {
  /**
   * Splits normalized text into chunks with overlap.
   */
  static chunk(
    text: string,
    sourceId: string,
    notebookId: string,
    options?: {
      chunkSize?: number;
      chunkOverlap?: number;
      metadata?: Record<string, any>;
    },
  ): SourceChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunkSize = options?.chunkSize ?? config.ingestion.chunkSize ?? 500;
    const chunkOverlap = options?.chunkOverlap ?? config.ingestion.chunkOverlap ?? 50;

    const chunks: SourceChunk[] = [];
    let startChar = 0;
    let chunkIndex = 0;

    const effectiveStep = Math.max(1, chunkSize - chunkOverlap);

    while (startChar < text.length) {
      let endChar = Math.min(text.length, startChar + chunkSize);

      // Attempt to break at natural boundary (newline or period/space) if not at end of text
      if (endChar < text.length) {
        const lastSpace = text.lastIndexOf(' ', endChar);
        const lastNewline = text.lastIndexOf('\n', endChar);
        const boundary = Math.max(lastSpace, lastNewline);
        if (boundary > startChar + Math.floor(chunkSize / 2)) {
          endChar = boundary;
        }
      }

      const content = text.slice(startChar, endChar).trim();

      if (content.length > 0) {
        const chunkId = `${sourceId}_chunk_${chunkIndex}`;
        chunks.push({
          chunkId,
          sourceId,
          notebookId,
          chunkIndex,
          content,
          text: content,
          metadata: {
            page: options?.metadata?.page ?? null,
            timestamp: options?.metadata?.timestamp ?? null,
            section: options?.metadata?.section ?? null,
            heading: options?.metadata?.heading ?? null,
            startChar,
            endChar,
            ...options?.metadata,
          },
        });
        chunkIndex++;
      }

      if (endChar >= text.length) {
        break;
      }

      startChar += effectiveStep;
      if (startChar >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
