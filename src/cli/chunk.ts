import { config } from '@/config';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runChunk(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'chunk' in orchestrator
      ? (orchestrator as IIngestionOrchestrator)
      : new IngestionOrchestrator(
          orchestrator && 'discover' in orchestrator && !('chunk' in orchestrator)
            ? (orchestrator as IInputDiscoveryService)
            : undefined,
        );

  console.log('Generating semantic chunks from transcripts...\n');

  let results;
  try {
    results = await orch.chunk();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Semantic chunking failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }

  if (results.length === 0) {
    console.log('No course transcripts found to chunk. Run transcript parsing first (`pnpm parse`).\n');
    return;
  }

  let hasFailures = false;

  for (const result of results) {
    console.log('Course');
    console.log(result.courseName || result.courseId);
    console.log();
    console.log('Lessons');
    console.log(result.lessonsCount.toLocaleString('en-US'));
    console.log();
    console.log('Transcripts Chunked');
    console.log(result.transcriptsChunkedCount.toLocaleString('en-US'));
    console.log();
    console.log('Total Chunks');
    console.log(result.totalChunksCount.toLocaleString('en-US'));
    console.log();
    console.log('Average Chunk Size');
    console.log(`${result.averageChunkSize.toLocaleString('en-US')} chars`);
    console.log();

    if (result.success) {
      console.log('Chunking completed successfully.');
    } else {
      hasFailures = true;
      console.log('Semantic chunking failed:');
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
    (process.argv[1].endsWith('chunk.ts') || process.argv[1].endsWith('chunk.js')));

if (isMainModule) {
  void runChunk();
}
