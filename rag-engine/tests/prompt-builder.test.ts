import { describe, it, expect } from 'vitest';
import { PromptBuilderService } from '../src/prompts/services/PromptBuilderService';
import { RetrievedChunk } from '../src/retrieval/RetrievalResult';

describe('PromptBuilderService', () => {
  const service = new PromptBuilderService();

  const mockChunk: RetrievedChunk = {
    chunkId: '1',
    score: 0.9,
    text: 'Expo Router is a file-based routing system.',
    metadata: {},
    chunk: {
      id: '1',
      text: 'Expo Router is a file-based routing system.',
      metadata: {
        courseId: 'c1',
        moduleId: 'm1',
        lessonId: 'l1',
        transcriptId: 't1'
      }
    },
    startTime: 0,
    endTime: 34,
    sourceReference: {
      courseId: 'c1',
      moduleId: 'm1',
      lessonId: 'l1'
    },
    citation: {
      courseName: 'Expo Mobile Development',
      moduleTitle: 'Module 4',
      lessonTitle: 'Introduction to Expo Router',
      startTime: 0,
      endTime: 34,
      similarityScore: 0.9
    }
  };

  it('should build a prompt with a single chunk', () => {
    const result = service.buildPrompt({
      query: 'How does Expo Router work?',
      chunks: [mockChunk]
    });

    expect(result.systemPrompt).toContain('You are a helpful AI assistant');
    expect(result.userPrompt).toContain('How does Expo Router work?');
    expect(result.combinedPrompt).toContain('Expo Router is a file-based routing system');
    expect(result.combinedPrompt).toContain('Expo Mobile Development');
    expect(result.combinedPrompt).toContain('00:00 → 00:34');
    expect(result.contextChunks).toBe(1);
    expect(result.contextCharacters).toBeGreaterThan(0);
  });

  it('should format multiple chunks properly while preserving order', () => {
    const chunk2 = {
      ...mockChunk,
      text: 'It is built on top of React Navigation.',
      citation: {
        ...mockChunk.citation,
        startTime: 34,
        endTime: 60,
      }
    } as RetrievedChunk;

    const result = service.buildPrompt({
      query: 'How does Expo Router work?',
      chunks: [mockChunk, chunk2]
    });

    expect(result.contextChunks).toBe(2);
    expect(result.combinedPrompt).toContain('Source 1');
    expect(result.combinedPrompt).toContain('Source 2');
    expect(result.combinedPrompt.indexOf('Source 1')).toBeLessThan(result.combinedPrompt.indexOf('Source 2'));
    expect(result.combinedPrompt).toContain('00:34 → 01:00');
  });

  it('should handle empty context gracefully', () => {
    const result = service.buildPrompt({
      query: 'Unknown concept',
      chunks: []
    });

    expect(result.contextChunks).toBe(0);
    expect(result.combinedPrompt).toContain('No context available');
    expect(result.combinedPrompt).toContain('Unknown concept');
  });
  
  it('should fallback to Unknown for missing citations', () => {
    const chunkNoCitation = {
      ...mockChunk,
      citation: undefined as any
    } as RetrievedChunk;

    const result = service.buildPrompt({
      query: 'What?',
      chunks: [chunkNoCitation]
    });

    expect(result.combinedPrompt).toContain('Unknown Course');
    expect(result.combinedPrompt).toContain('Unknown Module');
    expect(result.combinedPrompt).toContain('Unknown Lesson');
    expect(result.combinedPrompt).toContain('00:00 → 00:34'); // Falls back to chunk.startTime / chunk.endTime
  });
});
