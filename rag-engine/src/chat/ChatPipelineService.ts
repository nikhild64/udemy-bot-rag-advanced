import { performance } from 'node:perf_hooks';
import { logger } from '../shared/logger';
import { 
  ChatPipeline, 
  ChatRequest, 
  ChatResponse as PipelineChatResponse, 
  GuardRequest, 
  ChatResponse as AIChatResponse,
  ChatMessage
} from '../core/models';
import { InputGuardService } from '../guardrails/input/InputGuardService';
import { QueryTransformationStrategy } from '../core/contracts/query-transformation-strategy.contract';
import { RetrievalService } from '../retrieval/RetrievalService';
import { RerankerProvider } from '../core/contracts/reranker-provider.contract';
import { PromptBuilderService } from '../prompts/services/PromptBuilderService';
import { ChatProvider } from '../core/contracts/chat-provider.contract';
import { OutputGuardService } from '../guardrails/output/OutputGuardService';
import { SearchRequest } from '../retrieval/SearchRequest';
import { RerankRequest, RerankResult } from '../core/models/rerank.model';
import { AppError } from '../shared/errors';
import { RetrievedChunk } from '../retrieval/RetrievalResult';

export class ChatPipelineService implements ChatPipeline {
  constructor(
    private readonly inputGuardService: InputGuardService,
    private readonly queryTransformationStrategy: QueryTransformationStrategy,
    private readonly retrievalService: RetrievalService,
    private readonly rerankerProvider: RerankerProvider,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly chatProvider: ChatProvider,
    private readonly outputGuardService: OutputGuardService
  ) {}

  public async chat(request: ChatRequest): Promise<PipelineChatResponse> {
    logger.info({ query: request.query }, 'Chat pipeline started');
    const startTotal = performance.now();

    // Step 1: Input Guardrails
    const startInputGuard = performance.now();
    const guardRequest: GuardRequest = { query: request.query };
    const sanitizedRequest = await this.inputGuardService.validateAndSanitize(guardRequest);
    logger.debug({ durationMs: Math.round(performance.now() - startInputGuard) }, 'Input Guardrails completed');

    // Step 2: Query Transformation
    const startTransformation = performance.now();
    const transformationResult = await this.queryTransformationStrategy.transform(sanitizedRequest.query);
    logger.debug({ durationMs: Math.round(performance.now() - startTransformation) }, 'Query transformed');

    // Step 3 & 4: Embedding Generation & Vector Retrieval
    const startRetrieval = performance.now();
    const searchRequest: SearchRequest = {
      query: transformationResult.transformedQuery,
      topK: request.topK,
      filters: request.filters,
    };
    const retrievalResult = await this.retrievalService.search(searchRequest);
    logger.debug({ durationMs: Math.round(performance.now() - startRetrieval), count: retrievalResult.totalResults }, 'Retrieved chunks');

    if (retrievalResult.totalResults === 0) {
        logger.warn('No chunks retrieved. Pipeline stopping early.');
        return {
            answer: "I couldn't find any relevant information to answer your query.",
            citations: [],
            retrievedChunks: [],
            metadata: {
                totalDurationMs: Math.round(performance.now() - startTotal)
            }
        };
    }

    // Step 5: Reranking
    const startReranking = performance.now();
    const rerankRequest: RerankRequest<RetrievedChunk> = {
      query: transformationResult.transformedQuery,
      chunks: retrievalResult.retrievedChunks,
    };
    const rerankResult = await this.rerankerProvider.rerank(rerankRequest) as RerankResult<RetrievedChunk>;
    logger.debug({ durationMs: Math.round(performance.now() - startReranking) }, 'Reranking completed');

    // Step 6: Prompt Construction
    const startPrompt = performance.now();
    const promptBuildRequest = {
      query: sanitizedRequest.query, // Original user query (sanitized) is often better for prompt
      chunks: rerankResult.chunks,
    };
    const promptResult = this.promptBuilderService.buildPrompt(promptBuildRequest);
    logger.debug({ durationMs: Math.round(performance.now() - startPrompt) }, 'Prompt built');

    // Step 7: Chat Completion
    const startChat = performance.now();
    const messages: ChatMessage[] = [
        { role: 'system', content: promptResult.systemPrompt },
        { role: 'user', content: promptResult.combinedPrompt } // the combined prompt contains context and user query
    ];
    let aiResponse: AIChatResponse;
    try {
        aiResponse = await this.chatProvider.generateResponse(messages, { task: 'chat' });
    } catch (error) {
        logger.error({ err: error }, 'Chat provider failed');
        throw error; // Let AppErrors or specific errors propagate
    }
    logger.debug({ durationMs: Math.round(performance.now() - startChat) }, 'Chat completed');

    // Step 8: Output Guardrails
    const startOutputGuard = performance.now();
    const sanitizedAiResponse = await this.outputGuardService.validateAndSanitize(aiResponse);
    logger.debug({ durationMs: Math.round(performance.now() - startOutputGuard) }, 'Output Guardrails completed');

    // Step 9: Build Response
    const totalDurationMs = Math.round(performance.now() - startTotal);
    const pipelineResponse: PipelineChatResponse = {
      answer: sanitizedAiResponse.message.content,
      citations: retrievalResult.citations,
      retrievedChunks: rerankResult.chunks as RetrievedChunk[],
      metadata: {
        totalDurationMs,
        transformationStrategy: transformationResult.strategy,
      },
    };

    logger.info({ totalDurationMs }, 'Chat pipeline completed successfully');
    return pipelineResponse;
  }
}
