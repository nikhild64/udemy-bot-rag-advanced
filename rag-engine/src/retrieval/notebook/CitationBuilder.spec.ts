import { describe, it, expect } from 'vitest';
import { CitationBuilder } from './CitationBuilder';
import { NotebookRetrievedChunk } from './NotebookRetrievalResult';

describe('CitationBuilder', () => {
  it('should build citation records for chunks', () => {
    const chunks: NotebookRetrievedChunk[] = [
      {
        chunkId: 'c100',
        text: 'This is a long sentence explaining RAG retrieval pipeline architecture in detail.',
        score: 0.92,
        notebookId: 'nb_test',
        sourceId: 'src_doc_1',
        sourceName: 'RAG Architecture.pdf',
        sourceType: 'pdf',
        page: 5,
        timestamp: 120,
        metadata: {},
      },
    ];

    const citations = CitationBuilder.buildCitations(chunks);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      citationId: 'cit_c100',
      notebookId: 'nb_test',
      sourceId: 'src_doc_1',
      sourceName: 'RAG Architecture.pdf',
      sourceType: 'pdf',
      page: 5,
      timestamp: 120,
      chunkId: 'c100',
      snippet: expect.stringContaining('RAG retrieval pipeline'),
      similarityScore: 0.92,
    });
  });

  it('should return empty array for empty chunks', () => {
    const citations = CitationBuilder.buildCitations([]);
    expect(citations).toEqual([]);
  });
});
