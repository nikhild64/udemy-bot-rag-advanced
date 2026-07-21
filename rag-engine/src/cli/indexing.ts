import { config } from '@/config';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

/**
 * Runs the Knowledge Indexing pipeline.
 */
export async function runIndexing(orchestrator?: IIngestionOrchestrator): Promise<void> {
  const orch = orchestrator ?? new IngestionOrchestrator();

  console.log('Starting Knowledge Indexing pipeline...\n');

  try {
    const results = await orch.index({
      batchSize: config.indexing.batchSize,
      maxRetries: config.indexing.maxRetries,
      retryDelayMs: config.indexing.retryDelayMs,
    });

    console.log('================================================================================');
    console.log('                            KNOWLEDGE INDEXING RESULTS                          ');
    console.log('================================================================================\n');

    if (results.length === 0) {
      console.log('No courses were indexed.\n');
      return;
    }

    let allSuccessful = true;
    for (const res of results) {
      console.log('Course');
      console.log(res.courseName || res.courseId);
      console.log();
      console.log('Chunks');
      console.log(res.totalChunks.toLocaleString());
      console.log();
      console.log('Embeddings Generated');
      console.log(res.successfulEmbeddings.toLocaleString());
      console.log();
      console.log('Uploaded');
      console.log(res.successfulUploads.toLocaleString());
      console.log();
      console.log('Failed');
      console.log(res.failedChunks.toLocaleString());
      console.log();
      console.log('Duration');
      
      const seconds = Math.floor((res.durationMs / 1000) % 60);
      const minutes = Math.floor((res.durationMs / (1000 * 60)) % 60);
      const hours = Math.floor((res.durationMs / (1000 * 60 * 60)) % 24);
      console.log(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
      console.log();

      if (!res.success) {
        allSuccessful = false;
        console.log('Errors:');
        for (const err of res.errors) {
          console.log(`  - ${err}`);
        }
        console.log();
      }
      
      console.log('--------------------------------------------------------------------------------\n');
    }

    if (allSuccessful) {
      console.log('Knowledge indexing completed successfully.\n');
    } else {
      console.log('Knowledge indexing completed with errors.\n');
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Knowledge indexing pipeline failed:\n\nReason:\n${errorMessage}`);

    if (config.app.env === 'development' && error instanceof Error && error.stack) {
      console.error(`\n${error.stack}`);
    }

    process.exit(1);
  }
}

const isMainModule =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' &&
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith('indexing.ts') || process.argv[1].endsWith('indexing.js')));

if (isMainModule) {
  void runIndexing();
}
