import { performance } from 'node:perf_hooks';
import { MessageRole } from '@prisma/client';
import { NotebookService } from '@/services/NotebookService';
import { MessageService } from '@/services/MessageService';
import { RetrievalOrchestrator } from '@/retrieval/notebook/RetrievalOrchestrator';
import { NotebookPromptBuilder } from './NotebookPromptBuilder';
import { ChatProvider, ChatProviderOptions } from '@/core/contracts/chat-provider.contract';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';
import { ValidationError, AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import {
  NotebookChatOptions,
  NotebookChatResponse,
  NotebookChatStreamEvent,
} from './types';

export class NotebookChatOrchestrator {
  private readonly notebookService: NotebookService;
  private readonly messageService: MessageService;
  private readonly retrievalOrchestrator: RetrievalOrchestrator;
  private readonly promptBuilder: NotebookPromptBuilder;
  private readonly chatProvider: ChatProvider;

  constructor(
    notebookService?: NotebookService,
    messageService?: MessageService,
    retrievalOrchestrator?: RetrievalOrchestrator,
    promptBuilder?: NotebookPromptBuilder,
    chatProvider?: ChatProvider,
  ) {
    this.notebookService = notebookService ?? new NotebookService();
    this.messageService = messageService ?? new MessageService();
    this.retrievalOrchestrator = retrievalOrchestrator ?? new RetrievalOrchestrator();
    this.promptBuilder = promptBuilder ?? new NotebookPromptBuilder();
    this.chatProvider = chatProvider ?? ChatProviderFactory.create();
  }

  /**
   * Complete non-streaming AI conversation pipeline for a Notebook.
   */
  public async chat(options: NotebookChatOptions): Promise<NotebookChatResponse> {
    const totalStart = performance.now();

    this.validateOptions(options);

    const { notebookId, userId, query } = options;
    logger.info({ notebookId, userId, query }, 'Starting notebook chat pipeline execution');

    // 1. Validate Notebook Access
    const notebook = await this.notebookService.getNotebook(notebookId, userId);

    // 2. Save User Message
    const userMessage = await this.messageService.createMessage({
      notebookId,
      userId,
      role: MessageRole.USER,
      content: query,
    });

    // 3. Execute Notebook Retrieval
    const startRetrieval = performance.now();
    const retrievalResult = await this.retrievalOrchestrator.retrieve({
      notebookId,
      userId,
      query,
      topK: options.topK,
      filters: options.filters,
    });
    const retrievalDurationMs = Math.round(performance.now() - startRetrieval);

    // 4. Fetch Message History & Build Prompt
    const history = await this.messageService.getNotebookMessages(notebookId, userId, 10);
    // Exclude the current user message from history array to prevent duplicate inclusion
    const conversationHistory = history.filter((msg) => msg.id !== userMessage.id);

    const messages = this.promptBuilder.buildPrompt({
      query,
      context: retrievalResult.context,
      history: conversationHistory,
      notebookTitle: notebook.title,
    });

    // 5. Invoke LLM Chat Provider
    const startCompletion = performance.now();
    let aiResponse;
    try {
      const providerOptions: ChatProviderOptions = {
        task: 'chat',
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
      };
      aiResponse = await this.chatProvider.generateResponse(messages, providerOptions);
    } catch (err) {
      logger.error({ notebookId, err }, 'Chat Provider failed during notebook completion');
      throw err instanceof AppError ? err : new AppError('LLM generation failed', { statusCode: 500, cause: err });
    }
    const completionDurationMs = Math.round(performance.now() - startCompletion);

    const answerContent = aiResponse.message.content;

    // 6. Save Assistant Message with attached citations
    const assistantMessage = await this.messageService.createMessage({
      notebookId,
      userId,
      role: MessageRole.ASSISTANT,
      content: answerContent,
      citations: retrievalResult.citations,
      metadata: {
        model: options.model ?? 'default',
        retrievalDurationMs,
        completionDurationMs,
      },
    });

    const totalDurationMs = Math.round(performance.now() - totalStart);

    // 7. Structured Telemetry Logging
    logger.info(
      {
        notebookId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        retrievalDurationMs,
        completionDurationMs,
        totalDurationMs,
        promptCharacters: messages.reduce((acc, m) => acc + m.content.length, 0),
        citationCount: retrievalResult.citations.length,
      },
      'Notebook chat pipeline completed successfully',
    );

    return {
      message: assistantMessage,
      citations: retrievalResult.citations,
      retrievedChunks: retrievalResult.chunks,
      metadata: {
        notebookId,
        messageId: assistantMessage.id,
        retrievalDurationMs,
        completionDurationMs,
        totalDurationMs,
        promptCharacters: messages.reduce((acc, m) => acc + m.content.length, 0),
        citationCount: retrievalResult.citations.length,
        ...(options.model !== undefined ? { model: options.model } : {}),
      },
    };
  }

  /**
   * Streaming AI conversation pipeline for a Notebook via Server-Sent Events.
   */
  public async *stream(options: NotebookChatOptions): AsyncIterable<NotebookChatStreamEvent> {
    const totalStart = performance.now();

    yield { type: 'start' };

    try {
      this.validateOptions(options);

      const { notebookId, userId, query } = options;
      logger.info({ notebookId, userId, query }, 'Starting notebook streaming chat execution');

      // 1. Validate Notebook Access
      const notebook = await this.notebookService.getNotebook(notebookId, userId);

      // 2. Save User Message
      const userMessage = await this.messageService.createMessage({
        notebookId,
        userId,
        role: MessageRole.USER,
        content: query,
      });

      // 3. Execute Notebook Retrieval
      const startRetrieval = performance.now();
      const retrievalResult = await this.retrievalOrchestrator.retrieve({
        notebookId,
        userId,
        query,
        topK: options.topK,
        filters: options.filters,
      });
      const retrievalDurationMs = Math.round(performance.now() - startRetrieval);

      // 4. Yield Citations early to client stream
      for (const citation of retrievalResult.citations) {
        yield { type: 'citation', data: citation };
      }

      // 5. Fetch Message History & Build Prompt
      const history = await this.messageService.getNotebookMessages(notebookId, userId, 10);
      const conversationHistory = history.filter((msg) => msg.id !== userMessage.id);

      const messages = this.promptBuilder.buildPrompt({
        query,
        context: retrievalResult.context,
        history: conversationHistory,
        notebookTitle: notebook.title,
      });

      // 6. Invoke LLM Chat Provider Stream
      const startCompletion = performance.now();
      const providerOptions: ChatProviderOptions = {
        task: 'chat',
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
      };

      const streamIterator = this.chatProvider.streamResponse(messages, providerOptions);

      let fullAnswerText = '';
      for await (const chunk of streamIterator) {
        if (chunk.content) {
          fullAnswerText += chunk.content;
          yield { type: 'token', data: chunk.content };
        }
      }
      const completionDurationMs = Math.round(performance.now() - startCompletion);

      // 7. Save Assistant Message AFTER successful stream completion
      const assistantMessage = await this.messageService.createMessage({
        notebookId,
        userId,
        role: MessageRole.ASSISTANT,
        content: fullAnswerText,
        citations: retrievalResult.citations,
        metadata: {
          model: options.model ?? 'default',
          retrievalDurationMs,
          completionDurationMs,
          streamed: true,
        },
      });

      const totalDurationMs = Math.round(performance.now() - totalStart);

      logger.info(
        {
          notebookId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          retrievalDurationMs,
          completionDurationMs,
          totalDurationMs,
          citationCount: retrievalResult.citations.length,
        },
        'Notebook chat streaming pipeline completed successfully',
      );

      yield { type: 'done', data: { messageId: assistantMessage.id } };
    } catch (err) {
      logger.error({ notebookId: options.notebookId, err }, 'Notebook streaming chat pipeline failed');
      yield {
        type: 'error',
        data: { message: err instanceof Error ? err.message : 'Notebook chat streaming failed' },
      };
    }
  }

  private validateOptions(options: NotebookChatOptions): void {
    if (!options.notebookId || typeof options.notebookId !== 'string') {
      throw new ValidationError('notebookId is required and must be a string');
    }
    if (!options.userId || typeof options.userId !== 'string') {
      throw new ValidationError('userId is required and must be a string');
    }
    if (!options.query || typeof options.query !== 'string' || options.query.trim().length === 0) {
      throw new ValidationError('query is required and must be a non-empty string');
    }
  }
}
