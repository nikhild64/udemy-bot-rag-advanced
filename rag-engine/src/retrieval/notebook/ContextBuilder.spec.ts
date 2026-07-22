import { describe, it, expect } from 'vitest';
import { ContextBuilder } from './ContextBuilder';
import { NotebookRetrievedChunk } from './NotebookRetrievalResult';

describe('ContextBuilder', () => {
  const sampleChunks: NotebookRetrievedChunk[] = [
    {
      chunkId: 'c1',
      text: 'First chunk text about artificial intelligence.',
      score: 0.9,
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceName: 'AI Handbook.pdf',
      sourceType: 'pdf',
      page: 12,
      metadata: {},
    },
    {
      chunkId: 'c2',
      text: 'Second chunk text about machine learning algorithms.',
      score: 0.85,
      notebookId: 'nb1',
      sourceId: 'src2',
      sourceName: 'ML Guide.docx',
      sourceType: 'docx',
      page: 3,
      metadata: {},
    },
    {
      chunkId: 'c3',
      text: 'First chunk text about artificial intelligence.', // Duplicate
      score: 0.8,
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceName: 'AI Handbook.pdf',
      sourceType: 'pdf',
      page: 12,
      metadata: {},
    },
  ];

  it('should format context string with headers and deduplicate identical chunks', () => {
    const { context, includedChunks } = ContextBuilder.buildContext(sampleChunks, 4000);

    expect(includedChunks).toHaveLength(2);
    expect(includedChunks[0]!.chunkId).toBe('c1');
    expect(includedChunks[1]!.chunkId).toBe('c2');

    expect(context).toContain('--- Document Chunk [1] (Source: AI Handbook.pdf | Type: pdf | Page: 12) ---');
    expect(context).toContain('First chunk text about artificial intelligence.');
    expect(context).toContain('--- Document Chunk [2] (Source: ML Guide.docx | Type: docx | Page: 3) ---');
    expect(context).toContain('Second chunk text about machine learning algorithms.');
  });

  it('should respect maxTokens budget', () => {
    // Very small token budget to fit only 1 chunk
    const { includedChunks } = ContextBuilder.buildContext(sampleChunks, 35);
    expect(includedChunks.length).toBeLessThanOrEqual(1);
  });

  it('should return empty context if chunks list is empty', () => {
    const { context, includedChunks } = ContextBuilder.buildContext([], 1000);
    expect(context).toBe('');
    expect(includedChunks).toEqual([]);
  });
});
