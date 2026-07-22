import { describe, it, expect, vi } from 'vitest';
import { LLMEvaluator } from './LLMEvaluator';
import { ChatProvider } from '../../core/contracts/chat-provider.contract';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { ChatRole } from '@/types';

describe('LLMEvaluator', () => {
  const createMockChunk = (id: string, score: number): RetrievedChunk => ({
    chunkId: id,
    score,
    text: `Content for ${id}`,
    metadata: {},
    chunk: { id, text: `Content for ${id}`, metadata: {} },
    sourceReference: { courseId: 'c1', lessonId: 'l1', startTime: 0, endTime: 10 },
    citation: {
      chunkId: id,
      courseId: 'c1',
      courseName: 'C1',
      moduleId: 'm1',
      moduleTitle: 'M1',
      lessonId: 'l1',
      lessonTitle: 'L1',
      transcriptFile: 'f1.vtt',
      startTime: 0,
      endTime: 10,
      similarityScore: score,
    },
  });

  it('should parse valid JSON response from LLM chat provider', async () => {
    const mockChatProvider: ChatProvider = {
      generateResponse: vi.fn().mockResolvedValue({
        message: {
          role: ChatRole.ASSISTANT,
          content: JSON.stringify({
            decision: 'accept',
            confidence: 0.95,
            reasoning: 'The context contains full answer details.',
          }),
        },
      }),
      streamResponse: vi.fn(),
    };

    const evaluator = new LLMEvaluator(mockChatProvider, 0.7, 0.5);
    const chunks = [createMockChunk('c1', 0.8)];

    const result = await evaluator.evaluate('How to configure RAG?', chunks);

    expect(result.decision).toBe('accept');
    expect(result.score).toBe(0.95);
    expect(result.reasoning).toBe('The context contains full answer details.');
  });

  it('should fallback to SimilarityScoreEvaluator if LLM output is malformed', async () => {
    const mockChatProvider: ChatProvider = {
      generateResponse: vi.fn().mockResolvedValue({
        message: {
          role: ChatRole.ASSISTANT,
          content: 'Not valid json text',
        },
      }),
      streamResponse: vi.fn(),
    };

    const evaluator = new LLMEvaluator(mockChatProvider, 0.7, 0.5);
    const chunks = [createMockChunk('c1', 0.85)];

    const result = await evaluator.evaluate('How to configure RAG?', chunks);

    expect(result.decision).toBe('accept');
    expect(result.averageSimilarity).toBe(0.85);
  });
});
