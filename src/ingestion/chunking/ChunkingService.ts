import { Chunk, Transcript } from '@/core/models';
import { ParsingResult } from '@/ingestion/parsing';
import { ChunkingStrategyFactory, IChunkingStrategyFactory } from './strategies/ChunkingStrategyFactory';
import { ChunkValidator, IChunkValidator } from './ChunkValidator';
import { ChunkingResult, TranscriptChunkingResult } from './ChunkingResult';
import { ChunkingConfig, config } from '@/config';
import { logger } from '@/shared/logger';
import { ChunkingError, ValidationError } from '@/shared/errors';

export interface IChunkingService {
  /**
   * Chunk a single Transcript into semantically meaningful domain Chunk models.
   */
  chunkTranscript(
    transcript: Transcript,
    options?: {
      strategy?: string | undefined;
      config?: Partial<ChunkingConfig> | undefined;
      courseId?: string | undefined;
      courseTitle?: string | undefined;
      moduleId?: string | undefined;
      moduleTitle?: string | undefined;
      lessonTitle?: string | undefined;
      language?: string | undefined;
    },
  ): Promise<readonly Chunk[]>;

  /**
   * Chunk all transcripts across a ParsingResult from the parse stage.
   */
  chunkParsingResult(
    parsingResult: ParsingResult,
    options?: {
      strategy?: string | undefined;
      config?: Partial<ChunkingConfig> | undefined;
    },
  ): Promise<ChunkingResult>;
}

/**
 * Service responsible for orchestrating semantic chunking of parsed transcripts using strategies,
 * validating generated chunks, and returning metadata-rich results without embeddings.
 */
export class ChunkingService implements IChunkingService {
  private readonly strategyFactory: IChunkingStrategyFactory;
  private readonly validator: IChunkValidator;

  constructor(
    strategyFactory?: IChunkingStrategyFactory,
    validator?: IChunkValidator,
  ) {
    this.strategyFactory = strategyFactory ?? new ChunkingStrategyFactory();
    this.validator = validator ?? new ChunkValidator();
  }

  async chunkTranscript(
    transcript: Transcript,
    options?: {
      strategy?: string | undefined;
      config?: Partial<ChunkingConfig> | undefined;
      courseId?: string | undefined;
      courseTitle?: string | undefined;
      moduleId?: string | undefined;
      moduleTitle?: string | undefined;
      lessonTitle?: string | undefined;
      language?: string | undefined;
    },
  ): Promise<readonly Chunk[]> {
    const startTime = Date.now();
    if (!transcript) {
      throw new ChunkingError('Invalid transcript: transcript object is null or undefined');
    }
    if (!transcript.cues || transcript.cues.length === 0) {
      throw new ChunkingError(
        `Empty transcript: cannot generate chunks from empty transcript "${transcript.id}"`,
      );
    }

    const strategyName = options?.strategy ?? 'semantic';
    const strategy = this.strategyFactory.getStrategy(strategyName);
    const chunkConfig = {
      maxCharacters: options?.config?.maxCharacters ?? config.chunking.maxCharacters,
      overlapCharacters: options?.config?.overlapCharacters ?? config.chunking.overlapCharacters,
      minCharacters: options?.config?.minCharacters ?? config.chunking.minCharacters,
    };

    const courseId = options?.courseId ?? transcript.courseId ?? 'unknown-course';
    const moduleId = options?.moduleId ?? transcript.moduleId ?? 'unknown-module';
    const lessonId = transcript.lessonId || 'unknown-lesson';
    const transcriptId = transcript.id || 'unknown-transcript';

    logger.info(
      {
        transcriptId,
        strategy: strategy.name,
        courseId,
        moduleId,
        lessonId,
      },
      'Chunking started',
    );

    const chunksResult = await strategy.chunk(transcript, {
      courseId,
      courseTitle: options?.courseTitle,
      moduleId,
      moduleTitle: options?.moduleTitle,
      lessonId,
      lessonTitle: options?.lessonTitle,
      transcriptId,
      sourceFile: transcript.sourceFile,
      language: options?.language ?? transcript.language,
      config: chunkConfig,
    });

    const validation = this.validator.validate(chunksResult, chunkConfig);
    if (!validation.valid) {
      throw new ValidationError(
        `Chunk validation failed for transcript "${transcriptId}": ${validation.errors.join('; ')}`,
      );
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      {
        transcriptId,
        strategy: strategy.name,
        chunksGenerated: chunksResult.length,
        durationMs,
      },
      'Chunks generated',
    );

    return chunksResult;
  }

  async chunkParsingResult(
    parsingResult: ParsingResult,
    options?: {
      strategy?: string | undefined;
      config?: Partial<ChunkingConfig> | undefined;
    },
  ): Promise<ChunkingResult> {
    const startTime = Date.now();
    logger.info(
      {
        courseId: parsingResult.courseId,
        courseName: parsingResult.courseName,
        lessonsCount: parsingResult.lessonsCount,
      },
      'Chunking stage started for course',
    );

    const transcriptResults: TranscriptChunkingResult[] = [];
    const allChunks: Chunk[] = [];
    const errors: string[] = [];
    let transcriptsChunkedCount = 0;
    let failedTranscriptsCount = 0;

    for (const lessonRes of parsingResult.lessonResults) {
      if (!lessonRes.success || !lessonRes.transcript) {
        continue;
      }

      const ts = lessonRes.transcript;
      const tsStartTime = Date.now();
      try {
        const chunks = await this.chunkTranscript(ts, {
          strategy: options?.strategy,
          config: options?.config,
          courseId: lessonRes.courseId ?? ts.courseId ?? parsingResult.courseId,
          courseTitle: parsingResult.courseName,
          moduleId: lessonRes.moduleId ?? ts.moduleId ?? 'unknown-module',
          moduleTitle: lessonRes.moduleName,
          lessonTitle: lessonRes.lessonName,
        });

        transcriptsChunkedCount++;
        allChunks.push(...chunks);

        const totalCharSize = chunks.reduce(
          (acc, c) => acc + (c.characterCount ?? c.text.length),
          0,
        );
        const averageChunkSize = chunks.length > 0 ? Math.round(totalCharSize / chunks.length) : 0;

        transcriptResults.push({
          transcriptId: ts.id,
          lessonId: ts.lessonId,
          courseId: lessonRes.courseId ?? ts.courseId ?? parsingResult.courseId,
          moduleId: lessonRes.moduleId ?? ts.moduleId ?? 'unknown-module',
          chunksCount: chunks.length,
          averageChunkSize,
          durationMs: Date.now() - tsStartTime,
          success: true,
          chunks,
          errors: [],
        });
      } catch (error) {
        failedTranscriptsCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`[Transcript ${ts.id}] ${errorMessage}`);

        transcriptResults.push({
          transcriptId: ts.id,
          lessonId: ts.lessonId,
          courseId: lessonRes.courseId ?? ts.courseId ?? parsingResult.courseId,
          moduleId: lessonRes.moduleId ?? ts.moduleId ?? 'unknown-module',
          chunksCount: 0,
          averageChunkSize: 0,
          durationMs: Date.now() - tsStartTime,
          success: false,
          chunks: [],
          errors: [errorMessage],
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const totalChunksCount = allChunks.length;
    const totalChars = allChunks.reduce((acc, c) => acc + (c.characterCount ?? c.text.length), 0);
    const averageChunkSize = totalChunksCount > 0 ? Math.round(totalChars / totalChunksCount) : 0;
    const success = failedTranscriptsCount === 0 && parsingResult.success;

    const result: ChunkingResult = {
      courseId: parsingResult.courseId,
      courseName: parsingResult.courseName,
      lessonsCount: parsingResult.lessonsCount,
      transcriptsChunkedCount,
      failedTranscriptsCount,
      totalChunksCount,
      averageChunkSize,
      durationMs,
      success,
      chunks: allChunks,
      transcriptResults,
      errors: [...parsingResult.errors, ...errors],
    };

    logger.info(
      {
        courseId: parsingResult.courseId,
        totalChunksCount,
        averageChunkSize,
        durationMs,
        success,
      },
      'Chunking completed for course',
    );

    return result;
  }
}
