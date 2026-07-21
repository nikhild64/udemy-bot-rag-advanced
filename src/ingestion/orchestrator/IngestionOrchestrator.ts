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

  constructor(
    discoveryService?: IInputDiscoveryService,
    extractionService?: IExtractionService,
    manifestDiscoveryService?: ICourseManifestDiscoveryService,
    manifestBuilder?: ICourseManifestBuilder,
    manifestValidator?: IManifestValidator,
  ) {
    this.discoveryService = discoveryService ?? new InputDiscoveryService();
    this.extractionService = extractionService ?? new ExtractionService();
    this.manifestDiscoveryService =
      manifestDiscoveryService ?? new CourseManifestDiscoveryService();
    this.manifestBuilder = manifestBuilder ?? new CourseManifestBuilder();
    this.manifestValidator = manifestValidator ?? new ManifestValidator();
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

    const durationMs = Date.now() - startTime;
    const success = failedExtractions === 0 && failedManifests === 0;

    const result: IngestionResult = {
      totalArchivesDiscovered: archives.length,
      totalArchivesExtracted: archives.length,
      successfulExtractions,
      failedExtractions,
      totalManifestsGenerated: manifests.length,
      failedManifests,
      manifests,
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
