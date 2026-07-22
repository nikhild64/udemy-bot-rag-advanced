import { describe, it, expect, vi } from 'vitest';
import { HybridEvaluator } from './HybridEvaluator';
import { ChatProvider } from '../../core/contracts/chat-provider.contract';
import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { ChatRole } from '@/types';

describe('HybridEvaluator', () => {
  const createMockChunk = (id: string, score: number): RetrievedChunk => ({
    chunkId: id,
    score,
    text: `Sample content ${id}`,
    metadata: {},
    chunk: { id, text: `Sample content ${id}`, metadata: {} },
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

  it('should fast-path accept high average similarity without calling LLM', async () => {
    const mockChatProvider: ChatProvider = {
      generateResponse: vi.fn(),
      streamResponse: vi.fn(),
    };

    const evaluator = new HybridEvaluator(mockChatProvider, 0.7, 0.5, 0.85);
    const chunks = [createMockChunk('c1', 0.9), createMockChunk('c2', 0.88)];

    const result = await evaluator.evaluate('Query', chunks);

    expect(result.decision).toBe('accept');
    expect(mockChatProvider.generateResponse).not.toHaveBeenCalled();
  });

  it('should fast-path reject low max similarity without calling LLM', async () => {
    const mockChatProvider: ChatProvider = {
      generateResponse: vi.fn(),
      streamResponse: vi.fn(),
    };

    const evaluator = new HybridEvaluator(mockChatProvider, 0.7, 0.5, 0.85);
    const chunks = [createMockChunk('c1', 0.3), createMockChunk('c2', 0.2)];

    const result = await evaluator.evaluate('Query', chunks);

    expect(result.decision).toBe('reject');
    expect(mockChatProvider.generateResponse).not.toHaveBeenCalled();
  });

  it('should delegate to LLM for ambiguous score range', async () => {
    const mockChatProvider: ChatProvider = {
      generateResponse: vi.fn().mockResolvedValue({
        message: {
          role: ChatRole.ASSISTANT,
          content: JSON.stringify({ decision: 'correct', confidence: 0.6, reasoning: 'Partial coverage' }),
        },
      }),
      streamResponse: vi.fn(),
    };

    const evaluator = new HybridEvaluator(mockChatProvider, 0.7, 0.5, 0.85);
    const chunks = [createMockChunk('c1', 0.6), createMockChunk('c2', 0.55)];

    const result = await evaluator.evaluate('Query', chunks);

    expect(result.decision).toBe('correct');
    expect(mockChatProvider.generateResponse).toHaveBeenCalledOnce();
  });
});
