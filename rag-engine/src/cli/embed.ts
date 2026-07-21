import { config } from '@/config';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runEmbed(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'embed' in orchestrator
      ? (orchestrator as IIngestionOrchestrator)
      : new IngestionOrchestrator(
          orchestrator && 'discover' in orchestrator && !('embed' in orchestrator)
            ? (orchestrator as IInputDiscoveryService)
            : undefined,
        );

  console.log('Generating embedding vectors for semantic chunks...\n');

  let results;
  try {
    results = await orch.embed();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Embedding generation failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }

  if (results.length === 0) {
    console.log('No semantic chunks found to embed. Run chunking first (`pnpm chunk`).\n');
    return;
  }

  let hasFailures = false;

  for (const result of results) {
    console.log('Course');
    console.log(result.courseName || result.courseId);
    console.log();
    console.log('Chunks');
    console.log(result.chunksCount.toLocaleString('en-US'));
    console.log();
    console.log('Provider');
    console.log(result.providerName);
    console.log();
    console.log('Embedding Model');
    console.log(result.embeddingModel);
    console.log();
    console.log('Embeddings Generated');
    console.log(result.embeddingsGeneratedCount.toLocaleString('en-US'));
    console.log();

    if (result.success) {
      console.log('Completed successfully.');
    } else {
      hasFailures = true;
      console.log('Embedding generation failed:');
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
    (process.argv[1].endsWith('embed.ts') || process.argv[1].endsWith('embed.js')));

if (isMainModule) {
  void runEmbed();
}
