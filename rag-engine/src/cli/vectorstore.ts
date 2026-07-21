import { config } from '@/config';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runVectorStore(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'validateVectorStore' in orchestrator
      ? (orchestrator as IIngestionOrchestrator)
      : new IngestionOrchestrator(
          orchestrator && 'discover' in orchestrator && !('validateVectorStore' in orchestrator)
            ? (orchestrator as IInputDiscoveryService)
            : undefined,
        );

  console.log('Checking Vector Store connection and status...\n');

  try {
    const valid = await orch.validateVectorStore();

    console.log('Provider');
    console.log('Qdrant Cloud');
    console.log();
    console.log('Collection');
    console.log(config.vectorStore.vectorCollectionName);
    console.log();
    console.log('Status');
    console.log(valid ? 'Ready' : 'Not Ready');
    console.log();
    console.log('Connection successful.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Vector store check failed:\n\nReason:\n${errorMessage}`);

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
    (process.argv[1].endsWith('vectorstore.ts') || process.argv[1].endsWith('vectorstore.js')));

if (isMainModule) {
  void runVectorStore();
}
