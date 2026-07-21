import { ChatRole } from '@/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMRerankerProvider } from './LLMRerankerProvider';
import { ChatProvider } from '@/core/contracts';
import { logger } from '@/shared/logger';

vi.mock('@/shared/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('LLMRerankerProvider', () => {
  let mockChatProvider: ChatProvider;
  let reranker: LLMRerankerProvider<{ id: string; text: string }>;
  
  beforeEach(() => {
    mockChatProvider = {
      generateResponse: vi.fn(),
    };
    reranker = new LLMRerankerProvider(mockChatProvider, { topK: 3, batchSize: 2 });
    vi.clearAllMocks();
  });

  describe('Prompt Construction & Sorting', () => {
    it('constructs prompt with chunk IDs and text, parses response, and sorts by score', async () => {
      const chunks = [
        { id: 'chunk-1', text: 'Text 1' },
        { id: 'chunk-2', text: 'Text 2' }
      ];

      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: {
          role: ChatRole.ASSISTANT,
          content: '```json\n[\n  {"chunkId": "chunk-1", "score": 0.5},\n  {"chunkId": "chunk-2", "score": 0.9}\n]\n```',
        },
      });

      const result = await reranker.rerank({ query: 'test query', chunks });
      
      expect(mockChatProvider.generateResponse).toHaveBeenCalledTimes(1);
      const mockCalls = vi.mocked(mockChatProvider.generateResponse).mock.calls;
      expect(mockCalls[0][0][0].content).toContain('Candidate Passages');
      expect(mockCalls[0][1]).toEqual({ task: 'reranking' });
      expect(mockCalls[0][0][0].content).toContain('chunk-1');
      expect(mockCalls[0][0][0].content).toContain('Text 1');
      expect(mockCalls[0][0][0].content).toContain('test query');

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].id).toBe('chunk-2'); // Score 0.9
      expect(result.chunks[1].id).toBe('chunk-1'); // Score 0.5
    });

    it('processes chunks in multiple batches based on batchSize', async () => {
      const chunks = [
        { id: 'chunk-1', text: 'Text 1' },
        { id: 'chunk-2', text: 'Text 2' },
        { id: 'chunk-3', text: 'Text 3' },
      ];

      // Batch 1 (size 2)
      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: {
          role: ChatRole.ASSISTANT,
          content: '[{"chunkId": "chunk-1", "score": 0.3}, {"chunkId": "chunk-2", "score": 0.8}]',
        },
      });

      // Batch 2 (size 1)
      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: {
          role: ChatRole.ASSISTANT,
          content: '[{"chunkId": "chunk-3", "score": 0.9}]',
        },
      });

      const result = await reranker.rerank({ query: 'q', chunks });
      
      expect(mockChatProvider.generateResponse).toHaveBeenCalledTimes(2);
      expect(result.chunks).toHaveLength(3);
      expect(result.chunks[0].id).toBe('chunk-3');
      expect(result.chunks[1].id).toBe('chunk-2');
      expect(result.chunks[2].id).toBe('chunk-1');
    });
  });

  describe('Response Parsing and Validation', () => {
    const runFailureTest = async (mockResponse: string): Promise<void> => {
      const chunks = [
        { id: 'chunk-1', text: 'Text 1' },
        { id: 'chunk-2', text: 'Text 2' }
      ];

      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: {
          role: ChatRole.ASSISTANT,
          content: mockResponse,
        },
      });

      const result = await reranker.rerank({ query: 'q', chunks });
      
      // Should fall back to original order
      expect(result.chunks).toHaveLength(Math.min(chunks.length, reranker['topK']));
      expect(result.chunks[0].id).toBe('chunk-1');
      expect(result.chunks[1].id).toBe('chunk-2');
      expect(logger.error).toHaveBeenCalled();
    };

    it('falls back on malformed JSON', async () => {
      await runFailureTest('invalid json {');
    });

    it('falls back on missing score', async () => {
      await runFailureTest('[{"chunkId": "chunk-1"}]');
    });

    it('falls back on invalid score type', async () => {
      await runFailureTest('[{"chunkId": "chunk-1", "score": "high"}]');
    });
    
    it('falls back on out of range score', async () => {
      await runFailureTest('[{"chunkId": "chunk-1", "score": 1.5}]');
    });

    it('falls back on unknown chunk ID', async () => {
      await runFailureTest('[{"chunkId": "unknown-id", "score": 0.5}]');
    });

    it('assigns 0 score and warns on missing chunk ID from batch', async () => {
      const chunks = [
        { id: 'chunk-1', text: 'Text 1' },
        { id: 'chunk-2', text: 'Text 2' }
      ];
      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: { role: ChatRole.ASSISTANT, content: '[{"chunkId": "chunk-1", "score": 0.5}]' },
      });
      const result = await reranker.rerank({ query: 'q', chunks });
      expect(result.chunks[0].id).toBe('chunk-1'); // Score 0.5
      expect(result.chunks[1].id).toBe('chunk-2'); // Score 0
      expect(logger.warn).toHaveBeenCalled();
    });

    it('falls back on duplicate chunk ID', async () => {
      await runFailureTest('[{"chunkId": "chunk-1", "score": 0.5}, {"chunkId": "chunk-1", "score": 0.8}]');
    });
  });

  describe('Error Handling', () => {
    it('falls back when Chat Provider throws', async () => {
      const chunks = [{ id: 'chunk-1', text: 'Text 1' }];
      vi.mocked(mockChatProvider.generateResponse).mockRejectedValueOnce(new Error('API Down'));

      const result = await reranker.rerank({ query: 'q', chunks });
      
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].id).toBe('chunk-1');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        expect.any(String)
      );
    });
  });

  describe('Top K Selection', () => {
    it('returns only top K chunks', async () => {
      const chunks = [
        { id: 'chunk-1', text: '1' },
        { id: 'chunk-2', text: '2' },
        { id: 'chunk-3', text: '3' },
        { id: 'chunk-4', text: '4' },
      ];
      // Batch 1 (size 2)
      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: { role: ChatRole.ASSISTANT, content: '[{"chunkId": "chunk-1", "score": 0.1}, {"chunkId": "chunk-2", "score": 0.9}]' },
      });
      // Batch 2 (size 2)
      vi.mocked(mockChatProvider.generateResponse).mockResolvedValueOnce({
        message: { role: ChatRole.ASSISTANT, content: '[{"chunkId": "chunk-3", "score": 0.8}, {"chunkId": "chunk-4", "score": 0.2}]' },
      });

      const result = await reranker.rerank({ query: 'q', chunks });
      
      expect(result.chunks).toHaveLength(3); // topK is 3
      expect(result.chunks[0].id).toBe('chunk-2');
      expect(result.chunks[1].id).toBe('chunk-3');
      expect(result.chunks[2].id).toBe('chunk-4');
    });
  });
});
