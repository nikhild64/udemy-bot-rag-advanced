import { config } from '@/config';
import { IInputDiscoveryService } from '@/ingestion/discovery';
import { IIngestionOrchestrator, IngestionOrchestrator } from '@/ingestion/orchestrator';

export async function runDiscover(
  orchestrator?: IIngestionOrchestrator | IInputDiscoveryService,
): Promise<void> {
  const orch: IIngestionOrchestrator =
    orchestrator && 'execute' in orchestrator
      ? orchestrator
      : new IngestionOrchestrator(orchestrator as IInputDiscoveryService | undefined);

  console.log('Scanning input directory...\n');

  try {
    const archives = await orch.discover();

    for (const archive of archives) {
      console.log(`✓ ${archive.name}`);
    }

    if (archives.length > 0) {
      console.log();
    }

    console.log(`Found ${archives.length} supported archive(s).`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Discovery failed:\n\nReason:\n${errorMessage}`);

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
    (process.argv[1].endsWith('discover.ts') || process.argv[1].endsWith('discover.js')));

if (isMainModule) {
  void runDiscover();
}
