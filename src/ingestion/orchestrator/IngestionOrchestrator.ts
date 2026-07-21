import { config } from '@/config';
import { logger } from '@/shared/logger';
import { AppError, IngestionError } from '@/shared/errors';
import { IInputDiscoveryService, InputDiscoveryService, FileMetadata } from '../discovery';
import { IExtractionService, ExtractionService } from '../extraction';
import { IngestionContext, IngestionContextOptions } from './IngestionContext';
import { IngestionResult, ArchiveExtractionFailure } from './IngestionResult';

export interface IIngestionOrchestrator {
  /**
   * Run only the discovery stage of the ingestion pipeline.
   */
  discover(options?: IngestionContextOptions): Promise<FileMetadata[]>;

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

  constructor(
    discoveryService?: IInputDiscoveryService,
    extractionService?: IExtractionService,
  ) {
    this.discoveryService = discoveryService ?? new InputDiscoveryService();
    this.extractionService = extractionService ?? new ExtractionService();
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

    const durationMs = Date.now() - startTime;
    const success = failedExtractions === 0;

    const result: IngestionResult = {
      totalArchivesDiscovered: archives.length,
      totalArchivesExtracted: archives.length,
      successfulExtractions,
      failedExtractions,
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
