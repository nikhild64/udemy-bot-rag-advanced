import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatPipelineService } from './ChatPipelineService';
import { 
  ChatRequest, 
  GuardRequest, 
  GuardDecision, 
  ChatResponse as AIChatResponse 
} from '../core/models';
import { InputGuardError, OutputGuardError, AppError } from '../shared/errors';

// Mock dependencies
const mockInputGuardService = {
  validateAndSanitize: vi.fn(),
};

const mockQueryTransformationStrategy = {
  transform: vi.fn(),
};

const mockRetrievalService = {
  search: vi.fn(),
};

const mockRerankerProvider = {
  rerank: vi.fn(),
};

const mockPromptBuilderService = {
  buildPrompt: vi.fn(),
};

const mockChatProvider = {
  generateResponse: vi.fn(),
};

const mockOutputGuardService = {
  validateAndSanitize: vi.fn(),
};

describe('ChatPipelineService', () => {
  let chatPipelineService: ChatPipelineService;

  beforeEach(() => {
    vi.clearAllMocks();
    chatPipelineService = new ChatPipelineService(
      mockInputGuardService as any,
      mockQueryTransformationStrategy as any,
      mockRetrievalService as any,
      mockRerankerProvider as any,
      mockPromptBuilderService as any,
      mockChatProvider as any,
      mockOutputGuardService as any
    );
  });

  it('should successfully execute the full orchestration sequence', async () => {
    const request: ChatRequest = { query: 'test query' };
    
    // Setup mocks
    mockInputGuardService.validateAndSanitize.mockResolvedValue({ query: 'test query' });
    mockQueryTransformationStrategy.transform.mockResolvedValue({ 
      originalQuery: 'test query', 
      transformedQuery: 'transformed query', 
      strategy: 'noop' 
    });
    mockRetrievalService.search.mockResolvedValue({
      query: 'transformed query',
      totalResults: 1,
      retrievedChunks: [{ chunkId: '1', text: 'chunk text' }],
      citations: [{ chunkId: '1' }]
    });
    mockRerankerProvider.rerank.mockResolvedValue({
      query: 'transformed query',
      chunks: [{ chunkId: '1', text: 'chunk text' }],
      originalCount: 1,
      rerankedCount: 1,
      provider: 'noop'
    });
    mockPromptBuilderService.buildPrompt.mockReturnValue({
      systemPrompt: 'sys',
      userPrompt: 'user',
      combinedPrompt: 'sys context user',
      contextChunks: 1,
      contextCharacters: 10
    });
    mockChatProvider.generateResponse.mockResolvedValue({
      message: { role: 'model', content: 'test answer' }
    });
    mockOutputGuardService.validateAndSanitize.mockResolvedValue({
      message: { role: 'model', content: 'sanitized test answer' }
    });

    const response = await chatPipelineService.chat(request);

    // Verify correct execution order and responses
    expect(mockInputGuardService.validateAndSanitize).toHaveBeenCalledWith({ query: 'test query' });
    expect(mockQueryTransformationStrategy.transform).toHaveBeenCalledWith('test query');
    expect(mockRetrievalService.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'transformed query' }));
    expect(mockRerankerProvider.rerank).toHaveBeenCalledWith(expect.objectContaining({ query: 'transformed query', chunks: expect.any(Array) }));
    expect(mockPromptBuilderService.buildPrompt).toHaveBeenCalledWith({ query: 'test query', chunks: expect.any(Array) });
    expect(mockChatProvider.generateResponse).toHaveBeenCalled();
    expect(mockOutputGuardService.validateAndSanitize).toHaveBeenCalled();

    expect(response.answer).toBe('sanitized test answer');
    expect(response.citations).toHaveLength(1);
    expect(response.retrievedChunks).toHaveLength(1);
    expect(response.metadata?.transformationStrategy).toBe('noop');
  });

  it('should stop and throw if input guard fails', async () => {
    mockInputGuardService.validateAndSanitize.mockRejectedValue(new InputGuardError('Blocked', 'TestGuard'));

    await expect(chatPipelineService.chat({ query: 'bad query' })).rejects.toThrow(InputGuardError);
    
    // Verify no further execution
    expect(mockQueryTransformationStrategy.transform).not.toHaveBeenCalled();
    expect(mockRetrievalService.search).not.toHaveBeenCalled();
  });

  it('should return empty response if retrieval returns no chunks', async () => {
    mockInputGuardService.validateAndSanitize.mockResolvedValue({ query: 'test query' });
    mockQueryTransformationStrategy.transform.mockResolvedValue({ 
      originalQuery: 'test query', 
      transformedQuery: 'transformed query', 
      strategy: 'noop' 
    });
    mockRetrievalService.search.mockResolvedValue({
      query: 'transformed query',
      totalResults: 0,
      retrievedChunks: [],
      citations: []
    });

    const response = await chatPipelineService.chat({ query: 'test query' });

    expect(response.answer).toContain("couldn't find any relevant information");
    expect(response.citations).toEqual([]);
    expect(response.retrievedChunks).toEqual([]);

    // Verify pipeline short circuits
    expect(mockRerankerProvider.rerank).not.toHaveBeenCalled();
    expect(mockChatProvider.generateResponse).not.toHaveBeenCalled();
  });

  it('should propagate chat provider errors', async () => {
    mockInputGuardService.validateAndSanitize.mockResolvedValue({ query: 'test query' });
    mockQueryTransformationStrategy.transform.mockResolvedValue({ transformedQuery: 'transformed query' });
    mockRetrievalService.search.mockResolvedValue({ totalResults: 1, retrievedChunks: [] });
    mockRerankerProvider.rerank.mockResolvedValue({ chunks: [] });
    mockPromptBuilderService.buildPrompt.mockReturnValue({ combinedPrompt: 'prompt' });
    
    mockChatProvider.generateResponse.mockRejectedValue(new Error('API Down'));

    await expect(chatPipelineService.chat({ query: 'test query' })).rejects.toThrow('API Down');
    
    expect(mockOutputGuardService.validateAndSanitize).not.toHaveBeenCalled();
  });

  it('should propagate output guard failures', async () => {
    mockInputGuardService.validateAndSanitize.mockResolvedValue({ query: 'test query' });
    mockQueryTransformationStrategy.transform.mockResolvedValue({ transformedQuery: 'transformed query' });
    mockRetrievalService.search.mockResolvedValue({ totalResults: 1, retrievedChunks: [] });
    mockRerankerProvider.rerank.mockResolvedValue({ chunks: [] });
    mockPromptBuilderService.buildPrompt.mockReturnValue({ combinedPrompt: 'prompt' });
    mockChatProvider.generateResponse.mockResolvedValue({ message: { role: 'model', content: 'bad answer' } });
    
    mockOutputGuardService.validateAndSanitize.mockRejectedValue(new OutputGuardError('Blocked', 'TestGuard'));

    await expect(chatPipelineService.chat({ query: 'test query' })).rejects.toThrow(OutputGuardError);
  });
});
