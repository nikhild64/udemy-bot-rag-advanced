import { config } from '@/config';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IExtractionService } from '@/ingestion/extraction';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runExtract(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
  extractionService?: IExtractionService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'execute' in orchestrator
      ? orchestrator
      : new IngestionOrchestrator(
          orchestrator as IInputDiscoveryService | undefined,
          extractionService,
        );

  console.log('Executing ingestion workflow...\n');

  let result;
  try {
    result = await orch.execute();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Ingestion workflow failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }

  console.log('Ingestion Summary:');
  console.log(`  Discovered: ${result.totalArchivesDiscovered} archive(s)`);
  console.log(`  Extracted:  ${result.totalArchivesExtracted} archive(s)`);
  console.log(`  Success:    ${result.successfulExtractions}`);
  console.log(`  Failed:     ${result.failedExtractions}`);
  console.log(`  Duration:   ${result.durationMs} ms\n`);

  if (result.failures.length > 0) {
    console.log('Failures:');
    for (const failure of result.failures) {
      console.log(`  ✗ ${failure.archiveName}: ${failure.error}`);
    }
    console.log();
  }

  if (!result.success) {
    process.exit(1);
  }
}

const isMainModule =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' &&
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith('extract.ts') || process.argv[1].endsWith('extract.js')));

if (isMainModule) {
  void runExtract();
}
