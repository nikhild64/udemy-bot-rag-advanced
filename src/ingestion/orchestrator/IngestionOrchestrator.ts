import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '@/config';
import { logger } from '@/shared/logger';
import { AppError, IngestionError, NotFoundError } from '@/shared/errors';
import { IInputDiscoveryService, InputDiscoveryService, FileMetadata } from '../discovery';
import { IExtractionService, ExtractionService } from '../extraction';
import {
  ICourseManifestDiscoveryService,
  CourseManifestDiscoveryService,
  ICourseManifestBuilder,
  CourseManifestBuilder,
  IManifestValidator,
  ManifestValidator,
  ManifestResult,
  DiscoveredCourse,
} from '../manifest';
import {
  ITranscriptParsingService,
  TranscriptParsingService,
  ParsingResult,
} from '../parsing';
import {
  IChunkingService,
  ChunkingService,
  ChunkingResult,
} from '../chunking';
import {
  IEmbeddingService,
  EmbeddingService,
  EmbeddingResult,
} from '../embeddings';
import { VectorStore, VectorStoreFactory } from '@/providers/vectorstore';
import { IngestionContext, IngestionContextOptions } from './IngestionContext';
import { IngestionResult, ArchiveExtractionFailure } from './IngestionResult';

export interface IIngestionOrchestrator {
  /**
   * Run only the discovery stage of the ingestion pipeline.
   */
  discover(options?: IngestionContextOptions): Promise<FileMetadata[]>;

  /**
   * Run only the manifest generation stage of the ingestion pipeline.
   */
  manifest(options?: IngestionContextOptions): Promise<ManifestResult[]>;

  /**
   * Run only the transcript parsing stage of the ingestion pipeline.
   */
  parse(optionsOrManifests?: IngestionContextOptions | readonly ManifestResult[]): Promise<ParsingResult[]>;

  /**
   * Run only the semantic chunking stage of the ingestion pipeline.
   */
  chunk(optionsOrParsingResults?: IngestionContextOptions | readonly ParsingResult[]): Promise<ChunkingResult[]>;

  /**
   * Run only the embedding generation stage of the ingestion pipeline.
   */
  embed(optionsOrChunkingResults?: IngestionContextOptions | readonly ChunkingResult[]): Promise<EmbeddingResult[]>;

  /**
   * Run only the vector store validation stage of the ingestion pipeline.
   */
  validateVectorStore(optionsOrEmbeddingResults?: IngestionContextOptions | readonly EmbeddingResult[]): Promise<boolean>;

  /**
   * Execute the full ingestion workflow.
   */
  execute(options?: IngestionContextOptions): Promise<IngestionResult>;

  /**
   * Alias for execute() to support diverse caller preferences.
   */
  run(options?: IngestionContextOptions): Promise<IngestionResult>;
}

export class IngestionOrchestrator implements IIngestionOrchestrator {
  private readonly discoveryService: IInputDiscoveryService;
  private readonly extractionService: IExtractionService;
  private readonly manifestDiscoveryService: ICourseManifestDiscoveryService;
  private readonly manifestBuilder: ICourseManifestBuilder;
  private readonly manifestValidator: IManifestValidator;
  private readonly parsingService: ITranscriptParsingService;
  private readonly chunkingService: IChunkingService;
  private readonly embeddingService: IEmbeddingService;
  private readonly vectorStore: VectorStore;

  constructor(
    discoveryService?: IInputDiscoveryService,
    extractionService?: IExtractionService,
    manifestDiscoveryService?: ICourseManifestDiscoveryService,
    manifestBuilder?: ICourseManifestBuilder,
    manifestValidator?: IManifestValidator,
    parsingService?: ITranscriptParsingService,
    chunkingService?: IChunkingService,
    embeddingService?: IEmbeddingService,
    vectorStore?: VectorStore,
  ) {
    this.discoveryService = discoveryService ?? new InputDiscoveryService();
    this.extractionService = extractionService ?? new ExtractionService();
    this.manifestDiscoveryService =
      manifestDiscoveryService ?? new CourseManifestDiscoveryService();
    this.manifestBuilder = manifestBuilder ?? new CourseManifestBuilder();
    this.manifestValidator = manifestValidator ?? new ManifestValidator();
    this.parsingService = parsingService ?? new TranscriptParsingService();
    this.chunkingService = chunkingService ?? new ChunkingService();
    this.embeddingService = embeddingService ?? new EmbeddingService();
    this.vectorStore = vectorStore ?? VectorStoreFactory.create();
  }

  async discover(options?: IngestionContextOptions): Promise<FileMetadata[]> {
    const context = this.createContext(options);
    logger.info({ inputDirectory: context.inputDirectory }, 'Ingestion discovery stage started');

    try {
      const archives = await this.discoveryService.discover(context.inputDirectory);
      logger.info({ totalArchivesDiscovered: archives.length }, 'Discovery completed');
      return archives;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Ingestion discovery stage failed');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(`Discovery stage terminated unexpectedly: ${errorMessage}`, {
        cause: error,
      });
    }
  }

  async manifest(options?: IngestionContextOptions): Promise<ManifestResult[]> {
    const context = this.createContext(options);
    logger.info(
      { extractionDirectory: context.extractionDirectory },
      'Ingestion manifest stage started',
    );

    let discoveredCourses: DiscoveredCourse[] = [];
    try {
      if (this.manifestDiscoveryService.discoverAll) {
        discoveredCourses = await this.manifestDiscoveryService.discoverAll(
          context.extractionDirectory,
        );
      } else {
        const entries = await fs.readdir(context.extractionDirectory, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.name.startsWith('.') && entry.isDirectory()) {
            const courseDir = path.join(context.extractionDirectory, entry.name);
            discoveredCourses.push(await this.manifestDiscoveryService.discover(courseDir));
          }
        }
      }
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      ) {
        logger.info(
          { extractionDirectory: context.extractionDirectory },
          'Extraction directory not found or empty during manifest stage; returning empty manifests',
        );
        return [];
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Ingestion manifest stage failed');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(
        `Manifest discovery stage terminated unexpectedly: ${errorMessage}`,
        {
          cause: error,
        },
      );
    }

    const results: ManifestResult[] = [];
    for (const discoveredCourse of discoveredCourses) {
      const startTime = Date.now();
      const courseManifest = this.manifestBuilder.build(discoveredCourse);
      const validation = this.manifestValidator.validate(courseManifest);

      const modulesCount = courseManifest.modules.length;
      let lessonsCount = 0;
      let transcriptsCount = 0;
      let preferredTranscriptsCount = 0;
      let secondaryTranscriptsCount = 0;

      for (const mod of courseManifest.modules) {
        lessonsCount += mod.lessons.length;
        for (const lesson of mod.lessons) {
          transcriptsCount += lesson.transcripts.length;
          for (const transcript of lesson.transcripts) {
            if (transcript.preferred) {
              preferredTranscriptsCount++;
            } else {
              secondaryTranscriptsCount++;
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;
      const result: ManifestResult = {
        courseId: courseManifest.courseId,
        courseName: courseManifest.courseName,
        rootDirectory: courseManifest.rootDirectory,
        modulesCount,
        lessonsCount,
        transcriptsCount,
        preferredTranscriptsCount,
        secondaryTranscriptsCount,
        durationMs,
        success: validation.valid,
        manifest: courseManifest,
        validationErrors: validation.errors,
      };

      if (!validation.valid) {
        logger.warn(
          { courseId: courseManifest.courseId, validationErrors: validation.errors },
          'Manifest validation completed with errors',
        );
      } else {
        logger.info(
          {
            courseId: courseManifest.courseId,
            modulesCount,
            lessonsCount,
            transcriptsCount,
            durationMs,
          },
          'Manifest created successfully',
        );
      }

      results.push(result);
    }

    logger.info({ totalManifestsGenerated: results.length }, 'Manifest stage completed');
    return results;
  }

  async parse(
    optionsOrManifests?: IngestionContextOptions | readonly ManifestResult[],
  ): Promise<ParsingResult[]> {
    const manifests: readonly ManifestResult[] = Array.isArray(optionsOrManifests)
      ? optionsOrManifests
      : await this.manifest(optionsOrManifests as IngestionContextOptions | undefined);

    logger.info({ totalManifestsToParse: manifests.length }, 'Ingestion transcript parsing stage started');

    const results: ParsingResult[] = [];
    for (const m of manifests) {
      if (!m.success || !m.manifest) {
        logger.warn(
          { courseId: m.courseId },
          'Skipping transcript parsing for manifest with validation errors or missing manifest',
        );
        continue;
      }

      const startTime = Date.now();
      try {
        const parseRes = await this.parsingService.parseManifest(m.manifest);
        results.push(parseRes);
      } catch (error) {
        if (
          error instanceof NotFoundError ||
          (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        ) {
          logger.info(
            { courseId: m.courseId },
            'Transcript files not found during parse stage; returning empty parse result for course',
          );
          results.push({
            courseId: m.courseId,
            courseName: m.courseName,
            lessonsCount: m.lessonsCount,
            transcriptsParsedCount: 0,
            failedTranscriptsCount: 0,
            totalCuesCount: 0,
            durationMs: Date.now() - startTime,
            success: true,
            transcripts: [],
            lessonResults: [],
            errors: [],
          });
          continue;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ courseId: m.courseId, err: errorMessage }, 'Transcript parsing failed for course');
        const failedRes: ParsingResult = {
          courseId: m.courseId,
          courseName: m.courseName,
          lessonsCount: m.lessonsCount,
          transcriptsParsedCount: 0,
          failedTranscriptsCount: m.preferredTranscriptsCount || m.transcriptsCount,
          totalCuesCount: 0,
          durationMs: Date.now() - startTime,
          success: false,
          transcripts: [],
          lessonResults: [],
          errors: [errorMessage],
        };
        results.push(failedRes);
      }
    }

    const totalTranscripts = results.reduce((acc, r) => acc + r.transcriptsParsedCount, 0);
    const totalCues = results.reduce((acc, r) => acc + r.totalCuesCount, 0);
    logger.info(
      { totalManifestsParsed: results.length, totalTranscripts, totalCues },
      'Transcript parsing stage completed',
    );
    return results;
  }

  async chunk(
    optionsOrParsingResults?: IngestionContextOptions | readonly ParsingResult[],
  ): Promise<ChunkingResult[]> {
    const parsingResults: readonly ParsingResult[] = Array.isArray(optionsOrParsingResults)
      ? optionsOrParsingResults
      : await this.parse(optionsOrParsingResults as IngestionContextOptions | undefined);

    logger.info(
      { totalCoursesToChunk: parsingResults.length },
      'Ingestion semantic chunking stage started',
    );

    const results: ChunkingResult[] = [];
    for (const pRes of parsingResults) {
      if (!pRes.success || !pRes.lessonResults || pRes.lessonResults.length === 0) {
        logger.warn(
          { courseId: pRes.courseId },
          'Skipping chunking for course with parse errors or 0 lessons parsed',
        );
        results.push({
          courseId: pRes.courseId,
          courseName: pRes.courseName,
          lessonsCount: pRes.lessonsCount,
          transcriptsChunkedCount: 0,
          failedTranscriptsCount: pRes.failedTranscriptsCount,
          totalChunksCount: 0,
          averageChunkSize: 0,
          durationMs: 0,
          success: pRes.success,
          chunks: [],
          transcriptResults: [],
          errors: pRes.errors,
        });
        continue;
      }

      const chunkRes = await this.chunkingService.chunkParsingResult(pRes);
      results.push(chunkRes);
    }

    const totalChunks = results.reduce((acc, r) => acc + r.totalChunksCount, 0);
    logger.info(
      { totalCoursesChunked: results.length, totalChunks },
      'Semantic chunking stage completed',
    );
    return results;
  }

  async embed(
    optionsOrChunkingResults?: IngestionContextOptions | readonly ChunkingResult[],
  ): Promise<EmbeddingResult[]> {
    const chunkingResults: readonly ChunkingResult[] = Array.isArray(optionsOrChunkingResults)
      ? optionsOrChunkingResults
      : await this.chunk(optionsOrChunkingResults as IngestionContextOptions | undefined);

    logger.info(
      { totalCoursesToEmbed: chunkingResults.length },
      'Ingestion embedding generation stage started',
    );

    const results: EmbeddingResult[] = [];
    for (const cRes of chunkingResults) {
      if (!cRes.success || !cRes.chunks || cRes.chunks.length === 0) {
        logger.warn(
          { courseId: cRes.courseId },
          'Skipping embedding generation for course with chunking errors or 0 chunks',
        );
        results.push({
          courseId: cRes.courseId,
          courseName: cRes.courseName,
          providerName: 'unknown',
          embeddingModel: config.embeddings?.mistralEmbeddingModel ?? 'mistral-embed',
          chunksCount: cRes.totalChunksCount,
          embeddingsGeneratedCount: 0,
          failedChunksCount: cRes.totalChunksCount,
          durationMs: 0,
          success: cRes.success,
          embeddedChunks: [],
          errors: cRes.errors,
        });
        continue;
      }

      const embedRes = await this.embeddingService.embedChunkingResult(cRes);
      results.push(embedRes);
    }

    const totalEmbeddings = results.reduce((acc, r) => acc + r.embeddingsGeneratedCount, 0);
    logger.info(
      { totalCoursesEmbedded: results.length, totalEmbeddings },
      'Embedding generation stage completed',
    );
    return results;
  }

  async validateVectorStore(
    optionsOrEmbeddingResults?: IngestionContextOptions | readonly EmbeddingResult[],
  ): Promise<boolean> {
    const options = (
      !Array.isArray(optionsOrEmbeddingResults) ? optionsOrEmbeddingResults : undefined
    ) as (IngestionContextOptions & { isWorkflowStage?: boolean; embeddingResults?: readonly EmbeddingResult[] }) | undefined;

    logger.info('Ingestion vector store validation stage started');

    if (options?.isWorkflowStage === true) {
      const embeddingResults = options.embeddingResults ?? [];
      const totalEmbeddings = embeddingResults.reduce((acc, r) => acc + (r.embeddingsGeneratedCount || 0), 0);
      const totalFailedEmbeddings = embeddingResults.reduce((acc, r) => acc + (r.failedChunksCount || 0), 0);

      if (totalEmbeddings === 0 || totalFailedEmbeddings > 0) {
        logger.warn('Skipping vector store initialization/validation due to 0 embeddings or embedding errors');
        return false;
      }
    }

    try {
      const exists = await this.vectorStore.collectionExists();
      if (!exists) {
        await this.vectorStore.createCollection();
      }
      const valid = await this.vectorStore.validateCollection();
      logger.info({ valid }, 'Vector store validation completed');
      return valid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Vector store validation stage failed');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(
        `Ingestion workflow terminated unexpectedly during vector store validation stage: ${errorMessage}`,
        { cause: error },
      );
    }
  }

  async execute(options?: IngestionContextOptions): Promise<IngestionResult> {
    const startTime = Date.now();
    const context = this.createContext(options);

    logger.info(
      {
        inputDirectory: context.inputDirectory,
        extractionDirectory: context.extractionDirectory,
        executionTimestamp: context.executionTimestamp.toISOString(),
      },
      'Workflow started',
    );

    let archives: FileMetadata[] = [];
    try {
      archives = await this.discoveryService.discover(context.inputDirectory);
      logger.info({ totalArchivesDiscovered: archives.length }, 'Discovery completed');
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage, durationMs }, 'Workflow failed during discovery stage');

      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(`Ingestion workflow terminated unexpectedly: ${errorMessage}`, {
        cause: error,
      });
    }

    let successfulExtractions = 0;
    let failedExtractions = 0;
    const failures: ArchiveExtractionFailure[] = [];

    for (const archive of archives) {
      try {
        await this.extractionService.extract(archive, {
          destinationDirectory: context.extractionDirectory,
          ...(context.cleanBeforeExtract !== undefined
            ? { cleanBeforeExtract: context.cleanBeforeExtract }
            : {}),
        });
        successfulExtractions++;
      } catch (error) {
        failedExtractions++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        failures.push({
          archiveName: archive.name,
          error: errorMessage,
        });
      }
    }

    logger.info(
      {
        totalArchivesExtracted: archives.length,
        successfulExtractions,
        failedExtractions,
      },
      'Extraction completed',
    );

    let manifests: ManifestResult[] = [];
    let failedManifests = 0;
    try {
      manifests = await this.manifest(options);
      for (const m of manifests) {
        if (!m.success) {
          failedManifests++;
          failures.push({
            archiveName: m.courseName || m.courseId,
            error: `Manifest validation failed: ${m.validationErrors.join('; ')}`,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Workflow failed during manifest generation stage');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(
        `Ingestion workflow terminated unexpectedly during manifest generation stage: ${errorMessage}`,
        {
          cause: error,
        },
      );
    }

    let parsingResults: ParsingResult[] = [];
    let failedParsings = 0;
    let totalTranscriptsParsed = 0;
    let totalCuesParsed = 0;
    try {
      parsingResults = await this.parse(manifests);
      for (const p of parsingResults) {
        totalTranscriptsParsed += p.transcriptsParsedCount;
        totalCuesParsed += p.totalCuesCount;
        if (!p.success) {
          failedParsings++;
          failures.push({
            archiveName: p.courseName || p.courseId,
            error: `Transcript parsing failed: ${p.errors.join('; ')}`,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Workflow failed during transcript parsing stage');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(
        `Ingestion workflow terminated unexpectedly during transcript parsing stage: ${errorMessage}`,
        { cause: error },
      );
    }

    let chunkingResults: ChunkingResult[] = [];
    let failedChunkings = 0;
    let totalChunksGenerated = 0;
    try {
      chunkingResults = await this.chunk(parsingResults);
      for (const c of chunkingResults) {
        totalChunksGenerated += c.totalChunksCount;
        if (!c.success) {
          failedChunkings++;
          failures.push({
            archiveName: c.courseName || c.courseId,
            error: `Semantic chunking failed: ${c.errors.join('; ')}`,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Workflow failed during semantic chunking stage');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(
        `Ingestion workflow terminated unexpectedly during semantic chunking stage: ${errorMessage}`,
        { cause: error },
      );
    }

    let embeddingResults: EmbeddingResult[] = [];
    let failedEmbeddings = 0;
    let totalEmbeddingsGenerated = 0;
    try {
      embeddingResults = await this.embed(chunkingResults);
      for (const e of embeddingResults) {
        totalEmbeddingsGenerated += e.embeddingsGeneratedCount;
        if (!e.success) {
          failedEmbeddings++;
          failures.push({
            archiveName: e.courseName || e.courseId,
            error: `Embedding generation failed: ${e.errors.join('; ')}`,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: errorMessage }, 'Workflow failed during embedding generation stage');
      if (error instanceof AppError) {
        throw error;
      }
      throw new IngestionError(
        `Ingestion workflow terminated unexpectedly during embedding generation stage: ${errorMessage}`,
        { cause: error },
      );
    }

    let vectorStoreValidated = false;
    let vectorStoreInitialized = false;
    if (
      failedExtractions === 0 &&
      failedManifests === 0 &&
      failedParsings === 0 &&
      failedChunkings === 0 &&
      failedEmbeddings === 0
    ) {
      try {
        vectorStoreValidated = await this.validateVectorStore({
          ...context,
          isWorkflowStage: true,
          embeddingResults,
        } as IngestionContextOptions);
        vectorStoreInitialized = vectorStoreValidated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failures.push({
          archiveName: 'vectorstore',
          error: `Vector store validation failed: ${errorMessage}`,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const success =
      failedExtractions === 0 &&
      failedManifests === 0 &&
      failedParsings === 0 &&
      failedChunkings === 0 &&
      failedEmbeddings === 0 &&
      failures.length === 0;

    const result: IngestionResult = {
      totalArchivesDiscovered: archives.length,
      totalArchivesExtracted: archives.length,
      successfulExtractions,
      failedExtractions,
      totalManifestsGenerated: manifests.length,
      failedManifests,
      manifests,
      totalTranscriptsParsed,
      failedParsings,
      totalCuesParsed,
      parsingResults,
      totalChunksGenerated,
      failedChunkings,
      chunkingResults,
      totalEmbeddingsGenerated,
      failedEmbeddings,
      embeddingResults,
      vectorStoreInitialized,
      vectorStoreValidated,
      durationMs,
      success,
      failures,
    };

    logger.info(
      {
        totalArchivesDiscovered: result.totalArchivesDiscovered,
        totalArchivesExtracted: result.totalArchivesExtracted,
        successfulExtractions: result.successfulExtractions,
        failedExtractions: result.failedExtractions,
        totalManifestsGenerated: result.totalManifestsGenerated,
        failedManifests: result.failedManifests,
        totalTranscriptsParsed: result.totalTranscriptsParsed,
        failedParsings: result.failedParsings,
        totalCuesParsed: result.totalCuesParsed,
        totalChunksGenerated: result.totalChunksGenerated,
        failedChunkings: result.failedChunkings,
        totalEmbeddingsGenerated: result.totalEmbeddingsGenerated,
        failedEmbeddings: result.failedEmbeddings,
        durationMs: result.durationMs,
        success: result.success,
      },
      'Workflow finished',
    );

    return result;
  }

  async run(options?: IngestionContextOptions): Promise<IngestionResult> {
    return this.execute(options);
  }

  private createContext(options?: IngestionContextOptions): IngestionContext {
    return {
      inputDirectory: options?.inputDirectory ?? config.ingestion.inputDirectory,
      extractionDirectory: options?.extractionDirectory ?? config.ingestion.extractionDirectory,
      executionTimestamp: options?.executionTimestamp ?? new Date(),
      ...(options?.cleanBeforeExtract !== undefined
        ? { cleanBeforeExtract: options.cleanBeforeExtract }
        : {}),
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
    };
  }
}
