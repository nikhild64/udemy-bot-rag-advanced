import path from 'node:path';
import { IInputDiscoveryService, InputDiscoveryService } from '@/ingestion/discovery';
import { IExtractionService, ExtractionService } from '@/ingestion/extraction';
import { config } from '@/config';

export async function runExtract(
  discoveryService?: IInputDiscoveryService,
  extractionService?: IExtractionService,
): Promise<void> {
  const discovery = discoveryService ?? new InputDiscoveryService();
  const extraction = extractionService ?? new ExtractionService();

  console.log('Extracting...\n');

  let currentArchiveName: string | undefined;

  try {
    const archives = await discovery.discover();

    for (const archive of archives) {
      currentArchiveName = archive.name;
      const result = await extraction.extract(archive);
      const relativeDest = path
        .relative(process.cwd(), result.destinationPath)
        .split(path.sep)
        .join('/');

      console.log(`✓ ${result.archiveName}`);
      console.log(`  → ${relativeDest}\n`);
    }

    console.log('Extraction complete.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (currentArchiveName) {
      console.error(`Extraction failed:\n\n${currentArchiveName}\n\nReason:\n${errorMessage}`);
    } else {
      console.error(`Extraction failed:\n\nReason:\n${errorMessage}`);
    }

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
    (process.argv[1].endsWith('extract.ts') || process.argv[1].endsWith('extract.js')));

if (isMainModule) {
  void runExtract();
}
