import { config } from '@/config';
import { logger } from '@/shared/logger';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runManifest(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'manifest' in orchestrator
      ? (orchestrator as IIngestionOrchestrator)
      : new IngestionOrchestrator(
          orchestrator && 'discover' in orchestrator && !('manifest' in orchestrator)
            ? (orchestrator as IInputDiscoveryService)
            : undefined,
        );

  logger.info('Generating course manifests...');

  let results;
  try {
    results = await orch.manifest();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, `Manifest generation failed: ${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      logger.error(error.stack);
    }

    process.exit(1);
  }

  if (results.length === 0) {
    logger.info('No extracted courses found. Run extraction first (`pnpm extract`).');
    return;
  }

  let hasFailures = false;

  for (const result of results) {
    logger.info(
      {
        course: result.courseName,
        modules: result.modulesCount,
        lessons: result.lessonsCount,
        preferredTranscripts: result.preferredTranscriptsCount,
        secondaryTranscripts: result.secondaryTranscriptsCount,
      },
      `Course Manifest Summary: ${result.courseName}`,
    );

    if (result.success) {
      logger.info(`Manifest created successfully for ${result.courseName}.`);
    } else {
      hasFailures = true;
      logger.warn({ errors: result.validationErrors }, `Manifest validation failed for ${result.courseName}`);
    }
  }

  if (hasFailures) {
    process.exit(1);
  }
}

const isMainModule =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' &&
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith('manifest.ts') || process.argv[1].endsWith('manifest.js')));

if (isMainModule) {
  void runManifest();
}
