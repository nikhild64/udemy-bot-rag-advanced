import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDiscover, runExtract, runEmbed, runVectorStore } from '../src/cli';
import { IInputDiscoveryService, FileMetadata } from '../src/ingestion/discovery';
import { IExtractionService, ExtractionResult } from '../src/ingestion/extraction';
import { IIngestionOrchestrator, IngestionResult } from '../src/ingestion/orchestrator';
import { CourseManifestDiscoveryService } from '../src/ingestion/manifest';
import { NotFoundError } from '../src/shared/errors';
import { config } from '../src/config';

describe('CLI Commands', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit called with ${code}`);
    });
    vi.spyOn(CourseManifestDiscoveryService.prototype, 'discoverAll').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runDiscover', () => {
    it('should print discovered archives and total count', async () => {
      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockResolvedValue([
          { name: 'angular-course.zip', path: '/input/angular-course.zip', extension: '.zip', size: 1024, modifiedAt: new Date() } as FileMetadata,
          { name: 'react-course.zip', path: '/input/react-course.zip', extension: '.zip', size: 2048, modifiedAt: new Date() } as FileMetadata,
        ]),
      };

      await runDiscover(mockDiscoveryService);

      expect(logSpy).toHaveBeenCalledWith('Scanning input directory...\n');
      expect(logSpy).toHaveBeenCalledWith('✓ angular-course.zip');
      expect(logSpy).toHaveBeenCalledWith('✓ react-course.zip');
      expect(logSpy).toHaveBeenCalledWith('Found 2 supported archive(s).');
    });

    it('should handle zero discovered archives correctly', async () => {
      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockResolvedValue([]),
      };

      await runDiscover(mockDiscoveryService);

      expect(logSpy).toHaveBeenCalledWith('Scanning input directory...\n');
      expect(logSpy).toHaveBeenCalledWith('Found 0 supported archive(s).');
    });

    it('should print error message and exit with code 1 if discovery fails', async () => {
      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockRejectedValue(new NotFoundError('Input directory not found')),
      };

      await expect(runDiscover(mockDiscoveryService)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Discovery failed:\n\nReason:\nInput directory not found',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should allow delegating directly to IIngestionOrchestrator', async () => {
      const mockOrchestrator: IIngestionOrchestrator = {
        discover: vi.fn().mockResolvedValue([
          { name: 'orchestrated.zip', path: '/input/orchestrated.zip', extension: '.zip', size: 512, modifiedAt: new Date() } as FileMetadata,
        ]),
        execute: vi.fn(),
        run: vi.fn(),
      };

      await runDiscover(mockOrchestrator);

      expect(mockOrchestrator.discover).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('✓ orchestrated.zip');
    });
  });

  describe('runExtract', () => {
    it('should delegate to orchestrator.execute and display summarized workflow result', async () => {
      const mockResult: IngestionResult = {
        totalArchivesDiscovered: 2,
        totalArchivesExtracted: 2,
        successfulExtractions: 2,
        failedExtractions: 0,
        durationMs: 25,
        success: true,
        failures: [],
      };

      const mockOrchestrator: IIngestionOrchestrator = {
        discover: vi.fn(),
        execute: vi.fn().mockResolvedValue(mockResult),
        run: vi.fn(),
      };

      await runExtract(mockOrchestrator);

      expect(mockOrchestrator.execute).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('Executing ingestion workflow...\n');
      expect(logSpy).toHaveBeenCalledWith('Ingestion Summary:');
      expect(logSpy).toHaveBeenCalledWith('  Discovered: 2 archive(s)');
      expect(logSpy).toHaveBeenCalledWith('  Extracted:  2 archive(s)');
      expect(logSpy).toHaveBeenCalledWith('  Success:    2');
      expect(logSpy).toHaveBeenCalledWith('  Failed:     0');
      expect(logSpy).toHaveBeenCalledWith('  Duration:   25 ms\n');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should display failure breakdown and exit with code 1 if extraction of any archive fails', async () => {
      const mockResult: IngestionResult = {
        totalArchivesDiscovered: 2,
        totalArchivesExtracted: 2,
        successfulExtractions: 1,
        failedExtractions: 1,
        durationMs: 30,
        success: false,
        failures: [
          {
            archiveName: 'corrupt-course.zip',
            error: 'Archive is corrupt.',
          },
        ],
      };

      const mockOrchestrator: IIngestionOrchestrator = {
        discover: vi.fn(),
        execute: vi.fn().mockResolvedValue(mockResult),
        run: vi.fn(),
      };

      await expect(runExtract(mockOrchestrator)).rejects.toThrow('process.exit called with 1');

      expect(logSpy).toHaveBeenCalledWith('Failures:');
      expect(logSpy).toHaveBeenCalledWith('  ✗ corrupt-course.zip: Archive is corrupt.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should print error message and exit 1 if unexpected error occurs during orchestration execution', async () => {
      const mockOrchestrator: IIngestionOrchestrator = {
        discover: vi.fn(),
        execute: vi.fn().mockRejectedValue(new Error('Cannot access input folder.')),
        run: vi.fn(),
      };

      await expect(runExtract(mockOrchestrator)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Ingestion workflow failed:\n\nReason:\nCannot access input folder.',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should wrap legacy discovery/extraction services inside orchestrator when passed directly', async () => {
      const mockArchives: FileMetadata[] = [
        { name: 'angular-course.zip', path: '/input/angular-course.zip', extension: '.zip', size: 1024, modifiedAt: new Date() },
      ];

      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockResolvedValue(mockArchives),
      };

      const mockExtractionService: IExtractionService = {
        extract: vi.fn().mockResolvedValue({
          archiveName: 'angular-course.zip',
          destinationPath: '/extracted/angular-course',
          filesExtracted: ['lesson1.vtt'],
          durationMs: 10,
          success: true,
        } as ExtractionResult),
        extractAll: vi.fn(),
      };

      await runExtract(mockDiscoveryService, mockExtractionService);

      expect(mockDiscoveryService.discover).toHaveBeenCalledTimes(1);
      expect(mockExtractionService.extract).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('Ingestion Summary:');
      expect(logSpy).toHaveBeenCalledWith('  Success:    1');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('runEmbed', () => {
    it('should format output correctly when embeddings are generated', async () => {
      const mockOrchestrator = {
        embed: vi.fn().mockResolvedValue([
          {
            courseId: 'angular-masterclass',
            courseName: 'Angular Masterclass',
            providerName: 'Mistral',
            embeddingModel: 'mistral-embed',
            chunksCount: 2186,
            embeddingsGeneratedCount: 2186,
            failedChunksCount: 0,
            durationMs: 500,
            success: true,
            embeddedChunks: [],
            errors: [],
          },
        ]),
      } as unknown as IIngestionOrchestrator;

      await runEmbed(mockOrchestrator);

      expect(logSpy).toHaveBeenCalledWith('Generating embedding vectors for semantic chunks...\n');
      expect(logSpy).toHaveBeenCalledWith('Course');
      expect(logSpy).toHaveBeenCalledWith('Angular Masterclass');
      expect(logSpy).toHaveBeenCalledWith('Chunks');
      expect(logSpy).toHaveBeenCalledWith('2,186');
      expect(logSpy).toHaveBeenCalledWith('Provider');
      expect(logSpy).toHaveBeenCalledWith('Mistral');
      expect(logSpy).toHaveBeenCalledWith('Embedding Model');
      expect(logSpy).toHaveBeenCalledWith('mistral-embed');
      expect(logSpy).toHaveBeenCalledWith('Embeddings Generated');
      expect(logSpy).toHaveBeenCalledWith('2,186');
      expect(logSpy).toHaveBeenCalledWith('Completed successfully.');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should handle zero chunks gracefully', async () => {
      const mockOrchestrator = {
        embed: vi.fn().mockResolvedValue([]),
      } as unknown as IIngestionOrchestrator;

      await runEmbed(mockOrchestrator);

      expect(logSpy).toHaveBeenCalledWith(
        'No semantic chunks found to embed. Run chunking first (`pnpm chunk`).\n',
      );
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print errors and exit with 1 if embedding stage throws', async () => {
      const mockOrchestrator = {
        embed: vi.fn().mockRejectedValue(new Error('Provider API unreachable')),
      } as unknown as IIngestionOrchestrator;

      await expect(runEmbed(mockOrchestrator)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Embedding generation failed:\n\nReason:\nProvider API unreachable',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('runVectorStore', () => {
    it('should format output correctly when vector store connection and validation succeed', async () => {
      const mockOrchestrator = {
        validateVectorStore: vi.fn().mockResolvedValue(true),
      } as unknown as IIngestionOrchestrator;

      await runVectorStore(mockOrchestrator);

      expect(logSpy).toHaveBeenCalledWith('Checking Vector Store connection and status...\n');
      expect(logSpy).toHaveBeenCalledWith('Provider');
      expect(logSpy).toHaveBeenCalledWith('Qdrant Cloud');
      expect(logSpy).toHaveBeenCalledWith('Collection');
      expect(logSpy).toHaveBeenCalledWith(config.vectorStore.vectorCollectionName);
      expect(logSpy).toHaveBeenCalledWith('Status');
      expect(logSpy).toHaveBeenCalledWith('Ready');
      expect(logSpy).toHaveBeenCalledWith('Connection successful.');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should format output as Not Ready when validation returns false', async () => {
      const mockOrchestrator = {
        validateVectorStore: vi.fn().mockResolvedValue(false),
      } as unknown as IIngestionOrchestrator;

      await runVectorStore(mockOrchestrator);

      expect(logSpy).toHaveBeenCalledWith('Status');
      expect(logSpy).toHaveBeenCalledWith('Not Ready');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print error message and exit with 1 if vector store validation throws', async () => {
      const mockOrchestrator = {
        validateVectorStore: vi.fn().mockRejectedValue(new Error('Connection refused')),
      } as unknown as IIngestionOrchestrator;

      await expect(runVectorStore(mockOrchestrator)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Vector store check failed:\n\nReason:\nConnection refused',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});

