import { describe, it, expect } from 'vitest';
import { SourceChunker } from '@/ingestion/chunking/SourceChunker';

describe('SourceChunker', () => {
  it('should split text into chunks with metadata', () => {
    const text = 'First sentence of the document. Second sentence of the document. Third sentence of the document.';
    const chunks = SourceChunker.chunk(text, 'src-1', 'nb-1', {
      chunkSize: 50,
      chunkOverlap: 10,
      metadata: { page: 1, section: 'Intro' },
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.chunkId).toBe('src-1_chunk_0');
    expect(chunks[0]!.sourceId).toBe('src-1');
    expect(chunks[0]!.notebookId).toBe('nb-1');
    expect(chunks[0]!.metadata.page).toBe(1);
    expect(chunks[0]!.metadata.section).toBe('Intro');
    expect(chunks[0]!.content.length).toBeGreaterThan(0);
  });

  it('should return empty array when text is empty', () => {
    const chunks = SourceChunker.chunk('', 'src-1', 'nb-1');
    expect(chunks).toEqual([]);
  });
});
