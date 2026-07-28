import { performance } from 'node:perf_hooks';
import { MessageRole, Source } from '@prisma/client';
import { NotebookService } from '@/services/NotebookService';
import { MessageService } from '@/services/MessageService';
import { SourceService } from '@/services/SourceService';
import { RetrievalOrchestrator } from '@/retrieval/notebook/RetrievalOrchestrator';
import { NotebookPromptBuilder } from './NotebookPromptBuilder';
import { ChatProvider, ChatProviderOptions } from '@/core/contracts/chat-provider.contract';
import { ChatProviderFactory } from '@/providers/chat/ChatProviderFactory';
import { InputGuardService } from '@/guardrails/input/InputGuardService';
import { OutputGuardService } from '@/guardrails/output/OutputGuardService';
import { guardrailsConfig } from '@/config/guardrails';
import { MemoryProvider, MemoryItem } from '@/core/contracts/memory-provider.contract';
import { Mem0MemoryProvider } from '@/providers/memory/Mem0MemoryProvider';
import { config } from '@/config';
import { ChatRole } from '@/types';
import { ValidationError, AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { formatUserMemories } from '@/prompts/templates';
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
  private readonly sourceService: SourceService;
  private readonly inputGuardService: InputGuardService;
  private readonly outputGuardService: OutputGuardService;
  private readonly memoryProvider?: MemoryProvider;

  constructor(
    notebookService?: NotebookService,
    messageService?: MessageService,
    retrievalOrchestrator?: RetrievalOrchestrator,
    promptBuilder?: NotebookPromptBuilder,
    chatProvider?: ChatProvider,
    sourceService?: SourceService,
    inputGuardService?: InputGuardService,
    outputGuardService?: OutputGuardService,
    memoryProvider?: MemoryProvider,
  ) {
    this.notebookService = notebookService ?? new NotebookService();
    this.messageService = messageService ?? new MessageService();
    this.retrievalOrchestrator = retrievalOrchestrator ?? new RetrievalOrchestrator();
    this.promptBuilder = promptBuilder ?? new NotebookPromptBuilder();
    this.chatProvider = chatProvider ?? ChatProviderFactory.create();
    this.sourceService = sourceService ?? new SourceService();
    this.inputGuardService = inputGuardService ?? new InputGuardService(guardrailsConfig);
    this.outputGuardService = outputGuardService ?? new OutputGuardService(guardrailsConfig);
    this.memoryProvider = memoryProvider ?? new Mem0MemoryProvider(config.memory);
  }

  /**
   * Complete non-streaming AI conversation pipeline for a Notebook.
   */
  public async chat(options: NotebookChatOptions): Promise<NotebookChatResponse> {
    const totalStart = performance.now();

    this.validateOptions(options);

    // 0. Input Guardrails Check
    const sanitizedInput = await this.inputGuardService.validateAndSanitize({ query: options.query });
    options.query = sanitizedInput.query;

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

    // 4. Fetch Message History & Personal Memories
    const history = await this.messageService.getNotebookMessages(notebookId, userId, 10);
    // Exclude the current user message from history array to prevent duplicate inclusion
    const conversationHistory = history.filter((msg) => msg.id !== userMessage.id);

    let userMemories: MemoryItem[] = [];
    if (this.memoryProvider && userId) {
      userMemories = await this.memoryProvider
        .search({
          query,
          userId,
          topK: config.memory?.topK || 5,
        })
        .catch((err) => {
          logger.warn({ err, userId }, 'User memory search failed in NotebookChatOrchestrator');
          return [];
        });
    }

    const messages = this.promptBuilder.buildPrompt({
      query,
      context: retrievalResult.context,
      history: conversationHistory,
      notebookTitle: notebook.title,
      memories: userMemories,
    });

    // 5. Invoke LLM Chat Provider
    const startCompletion = performance.now();
    let aiResponse;
    try {
      const providerOptions: ChatProviderOptions = {
        task: 'chat',
        maxTokens: options.maxTokens ?? 4096,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      };
      aiResponse = await this.chatProvider.generateResponse(messages, providerOptions);
    } catch (err) {
      logger.error({ notebookId, err }, 'Chat Provider failed during notebook completion');
      throw err instanceof AppError ? err : new AppError('LLM generation failed', { statusCode: 500, cause: err });
    }
    const completionDurationMs = Math.round(performance.now() - startCompletion);

    const answerContent = aiResponse.message.content;

    // Async Non-Blocking Memory Consolidation
    if (this.memoryProvider && userId && answerContent) {
      this.memoryProvider
        .add({
          userId,
          messages: [
            { role: 'user', content: query },
            { role: 'assistant', content: answerContent },
          ],
        })
        .catch((err) => {
          logger.warn({ err, userId }, 'Background memory extraction failed in NotebookChatOrchestrator');
        });
    }

    logger.info(
      {
        context: 'RAG Engine',
        phase: 'answer-generation',
        notebookId,
        durationMs: completionDurationMs,
        promptCharacters: messages.reduce((acc, m) => acc + m.content.length, 0),
        responseCharacters: answerContent.length,
      },
      `[Phase 6] LLM Answer Generation Completed (${completionDurationMs}ms)`,
    );

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
        context: 'RAG Engine',
        phase: 'pipeline-summary',
        notebookId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        retrievalDurationMs,
        completionDurationMs,
        totalDurationMs,
        promptCharacters: messages.reduce((acc, m) => acc + m.content.length, 0),
        citationCount: retrievalResult.citations.length,
      },
      `[RAG Pipeline Complete] End-to-End Execution Completed (${totalDurationMs}ms | Retrieval: ${retrievalDurationMs}ms | LLM: ${completionDurationMs}ms)`,
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

      // 0. Input Guardrails Check
      const sanitizedInput = await this.inputGuardService.validateAndSanitize({ query: options.query });
      options.query = sanitizedInput.query;

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

      // 5. Fetch Message History & Personal Memories
      const history = await this.messageService.getNotebookMessages(notebookId, userId, 10);
      const conversationHistory = history.filter((msg) => msg.id !== userMessage.id);

      let userMemories: MemoryItem[] = [];
      if (this.memoryProvider && userId) {
        userMemories = await this.memoryProvider
          .search({
            query,
            userId,
            topK: config.memory?.topK || 5,
          })
          .catch((err) => {
            logger.warn({ err, userId }, 'User memory search failed in NotebookChatOrchestrator stream');
            return [];
          });
      }

      const messages = this.promptBuilder.buildPrompt({
        query,
        context: retrievalResult.context,
        history: conversationHistory,
        notebookTitle: notebook.title,
        memories: userMemories,
      });

      // 6. Invoke LLM Chat Provider Stream
      const startCompletion = performance.now();
      const providerOptions: ChatProviderOptions = {
        task: 'chat',
        maxTokens: options.maxTokens ?? 4096,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
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

      // Async Non-Blocking Memory Consolidation
      if (this.memoryProvider && userId && fullAnswerText) {
        this.memoryProvider
          .add({
            userId,
            messages: [
              { role: 'user', content: query },
              { role: 'assistant', content: fullAnswerText },
            ],
          })
          .catch((err) => {
            logger.warn({ err, userId }, 'Background memory extraction failed in NotebookChatOrchestrator stream');
          });
      }

      // 6b. Output Guardrails Check
      try {
        await this.outputGuardService.validateAndSanitize({
          message: { role: ChatRole.ASSISTANT, content: fullAnswerText },
        });
      } catch (err) {
        logger.warn({ notebookId, err }, 'Output guardrails rejected the streamed response');
        yield { type: 'error', data: { message: 'The generated response violated safety policies.' } };
        return;
      }

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

  /**
   * Generate 3-4 LLM-based contextual suggested questions for a Notebook.
   */
  public async generateSuggestedQuestions(notebookId: string, userId: string): Promise<string[]> {
    try {
      const notebook = await this.notebookService.getNotebook(notebookId, userId);
      const history = await this.messageService.getNotebookMessages(notebookId, userId, 6);
      const currentMessageCount = history.length;

      // 1. Check if suggested questions are already cached in notebook.settings for this chat state
      const settings = (notebook.settings as Record<string, any>) || {};
      const cached = settings.suggestedQuestions;

      if (
        cached &&
        Array.isArray(cached.questions) &&
        cached.questions.length > 0 &&
        cached.lastMessageCount === currentMessageCount
      ) {
        logger.info(
          { notebookId, count: currentMessageCount, questionsCount: cached.questions.length },
          '[SuggestedQuestions] Returning cached suggested questions for notebook',
        );
        return cached.questions;
      }

      // 2. Fetch User Personal Memories & Source Content Chunks
      let userMemories: MemoryItem[] = [];
      if (this.memoryProvider && userId) {
        userMemories = await this.memoryProvider.getAll(userId).catch(() => []);
      }
      const memoryContext = userMemories.length > 0 ? formatUserMemories(userMemories) : '';

      const lastUserQuery = history.length > 0
        ? history.filter((m) => m.role === MessageRole.USER).pop()?.content || 'key concepts overview'
        : 'key concepts overview main topics summary';

      const retrievalResult = await this.retrievalOrchestrator
        .retrieve({
          notebookId,
          userId,
          query: lastUserQuery,
          topK: 5,
        })
        .catch(() => ({ context: '' }));
      const sourceContext = retrievalResult.context || '';

      let contextPrompt = '';
      if (history.length > 0) {
        const conversationText = history
          .map((msg) => `${msg.role.toUpperCase()}: ${msg.content.slice(0, 300)}`)
          .join('\n');
        contextPrompt = `Notebook Title: "${notebook.title}"\n\nRecent Conversation:\n${conversationText}\n\nRetrieved Source Context:\n${sourceContext.slice(0, 1500)}${memoryContext ? `\n\n${memoryContext}` : ''}\n\nBased on this conversation, source material, and user preferences, generate 3 to 4 concise, high-value follow-up questions the user might ask next.`;
      } else {
        const sourcesResult = await this.sourceService.listSources(notebookId, userId, { limit: 5 });
        const sources = sourcesResult.data || [];
        const sourceTitles = sources
          .map((s: Source) => s.displayName || s.title || (s.metadata as any)?.originalName || s.type)
          .filter(Boolean)
          .join(', ');

        contextPrompt = `Notebook Title: "${notebook.title}"\nKnowledge Sources: ${sourceTitles || 'Uploaded documents'}\n\nRetrieved Knowledge Base Excerpts:\n${sourceContext.slice(0, 1500)}${memoryContext ? `\n\n${memoryContext}` : ''}\n\nBased on these knowledge sources and user preferences, generate 3 to 4 concise, intriguing initial questions the user can ask about these topics.`;
      }

      const systemPrompt = `You are a helpful study assistant. Output ONLY a valid JSON array of 3 to 4 short question strings (max 12 words per question). Do not include markdown formatting, preambles, or explanations. Example output: ["What are the main concepts?", "How does this compare to traditional models?", "Can you summarize the key findings?"]`;

      const response = await this.chatProvider.generateResponse(
        [
          { role: ChatRole.SYSTEM, content: systemPrompt },
          { role: ChatRole.USER, content: contextPrompt },
        ],
        { task: 'chat', maxTokens: 250, temperature: 0.7 }
      );

      const raw = response.message.content.trim();
      const jsonMatch = raw.match(/\[\s*".*?"\s*\]/s) || [raw];
      const parsed = JSON.parse(jsonMatch[0]);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const questions = parsed
          .map((q: any) => String(q).trim())
          .filter((q: string) => q.length > 0)
          .slice(0, 4);

        // 3. Cache generated suggested questions into notebook.settings
        try {
          const updatedSettings = {
            ...settings,
            suggestedQuestions: {
              questions,
              lastMessageCount: currentMessageCount,
              updatedAt: new Date().toISOString(),
            },
          };
          await this.notebookService.updateNotebook(notebookId, userId, { settings: updatedSettings });
        } catch (saveErr: any) {
          logger.warn({ notebookId, err: saveErr?.message }, '[SuggestedQuestions] Failed to save questions in notebook settings');
        }

        return questions;
      }
    } catch (err) {
      logger.warn({ notebookId, err }, 'Failed to generate LLM suggested questions, falling back to default suggestions');
    }

    return [
      'Summarize the key themes across my sources',
      'What are the most important insights from this notebook?',
      'Explain the core concepts and definitions mentioned',
      'Synthesize the main arguments and conclusions',
    ];
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
