import { config } from '@/config';
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

  console.log('Generating course manifests...\n');

  let results;
  try {
    results = await orch.manifest();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Manifest generation failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }

  if (results.length === 0) {
    console.log('No extracted courses found. Run extraction first (`pnpm extract`).\n');
    return;
  }

  let hasFailures = false;

  for (const result of results) {
    console.log('Course');
    console.log(result.courseName);
    console.log();
    console.log('Modules');
    console.log(result.modulesCount);
    console.log();
    console.log('Lessons');
    console.log(result.lessonsCount);
    console.log();
    console.log('Preferred transcripts');
    console.log(`${result.preferredTranscriptsCount} VTT`);
    console.log();
    console.log('Secondary transcripts');
    console.log(`${result.secondaryTranscriptsCount} SRT`);
    console.log();

    if (result.success) {
      console.log('Manifest created successfully.');
    } else {
      hasFailures = true;
      console.log('Manifest validation failed:');
      for (const err of result.validationErrors) {
        console.log(`  ✗ ${err}`);
      }
    }
    console.log();
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
