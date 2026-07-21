import { config } from '@/config';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runParse(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'parse' in orchestrator
      ? (orchestrator as IIngestionOrchestrator)
      : new IngestionOrchestrator(
          orchestrator && 'discover' in orchestrator && !('parse' in orchestrator)
            ? (orchestrator as IInputDiscoveryService)
            : undefined,
        );

  console.log('Parsing course transcripts...\n');

  let results;
  try {
    results = await orch.parse();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Transcript parsing failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }

  if (results.length === 0) {
    console.log('No course manifests found to parse. Run manifest generation first (`pnpm manifest`).\n');
    return;
  }

  let hasFailures = false;

  for (const result of results) {
    console.log('Course');
    console.log(result.courseName);
    console.log();
    console.log('Lessons');
    console.log(result.lessonsCount.toLocaleString('en-US'));
    console.log();
    console.log('Transcripts Parsed');
    console.log(result.transcriptsParsedCount.toLocaleString('en-US'));
    console.log();
    console.log('Total Cues');
    console.log(result.totalCuesCount.toLocaleString('en-US'));
    console.log();

    if (result.success) {
      console.log('Parsing completed successfully.');
    } else {
      hasFailures = true;
      console.log('Transcript parsing failed:');
      for (const err of result.errors) {
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
    (process.argv[1].endsWith('parse.ts') || process.argv[1].endsWith('parse.js')));

if (isMainModule) {
  void runParse();
}
