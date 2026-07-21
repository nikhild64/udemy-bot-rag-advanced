import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IngestionOrchestrator,
  IngestionContextOptions,
  IngestionResult,
} from '../src/ingestion/orchestrator';
import { IInputDiscoveryService, FileMetadata } from '../src/ingestion/discovery';
import { IExtractionService } from '../src/ingestion/extraction';
import { IEmbeddingService } from '../src/ingestion/embeddings';
import { ICourseManifestDiscoveryService } from '../src/ingestion/manifest';
import { IngestionError, NotFoundError } from '../src/shared/errors';
import { logger } from '../src/shared/logger';

describe('IngestionOrchestrator', () => {
  let mockDiscoveryService: IInputDiscoveryService;
  let mockExtractionService: IExtractionService;
  let mockManifestDiscoveryService: ICourseManifestDiscoveryService;
  let orchestrator: IngestionOrchestrator;
  let logInfoSpy: ReturnType<typeof vi.spyOn>;
  let logErrorSpy: ReturnType<typeof vi.spyOn>;

  const mockArchives: FileMetadata[] = [
    {
      name: 'react-course.zip',
      path: '/input/react-course.zip',
      extension: '.zip',
      size: 1024,
      modifiedAt: new Date(),
    },
    {
      name: 'node-course.zip',
      path: '/input/node-course.zip',
      extension: '.zip',
      size: 2048,
      modifiedAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockDiscoveryService = {
      discover: vi.fn().mockResolvedValue(mockArchives),
    };

    mockExtractionService = {
      extract: vi.fn().mockImplementation(async (archive: FileMetadata) => ({
        archiveName: archive.name,
        destinationPath: `/extracted/${archive.name.replace('.zip', '')}`,
        filesExtracted: ['lesson1.vtt'],
        durationMs: 15,
        success: true,
      })),
      extractAll: vi.fn(),
    };

    mockManifestDiscoveryService = {
      discover: vi.fn().mockRejectedValue(new NotFoundError('Mock course not found')),
      discoverAll: vi.fn().mockResolvedValue([]),
    };

    orchestrator = new IngestionOrchestrator(
      mockDiscoveryService,
      mockExtractionService,
      mockManifestDiscoveryService,
    );

    logInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);
    logErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);
  });

  describe('discover()', () => {
    it('should coordinate discovery using discoveryService and return file metadata', async () => {
      const result = await orchestrator.discover({ inputDirectory: '/custom/input' });

      expect(mockDiscoveryService.discover).toHaveBeenCalledWith('/custom/input');
      expect(result).toEqual(mockArchives);
      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ inputDirectory: '/custom/input' }),
        'Ingestion discovery stage started',
      );
      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ totalArchivesDiscovered: 2 }),
        'Discovery completed',
      );
    });

    it('should rethrow AppError directly when discovery fails with AppError', async () => {
      const notFoundErr = new NotFoundError('Directory not found');
      mockDiscoveryService.discover = vi.fn().mockRejectedValue(notFoundErr);

      await expect(orchestrator.discover()).rejects.toThrow(NotFoundError);
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'Directory not found' }),
        'Ingestion discovery stage failed',
      );
    });

    it('should wrap generic error into IngestionError when discovery fails unexpectedly', async () => {
      mockDiscoveryService.discover = vi.fn().mockRejectedValue(new Error('Disk read error'));

      await expect(orchestrator.discover()).rejects.toThrow(IngestionError);
      await expect(orchestrator.discover()).rejects.toThrow(
        'Discovery stage terminated unexpectedly: Disk read error',
      );
    });
  });

  describe('execute()', () => {
    it('should execute full workflow across discovered archives and return summarized result', async () => {
      const customOptions: IngestionContextOptions = {
        inputDirectory: '/input/path',
        extractionDirectory: '/extracted/path',
        cleanBeforeExtract: false,
      };

      const result: IngestionResult = await orchestrator.execute(customOptions);

      expect(mockDiscoveryService.discover).toHaveBeenCalledWith('/input/path');
      expect(mockExtractionService.extract).toHaveBeenCalledTimes(2);
      expect(mockExtractionService.extract).toHaveBeenNthCalledWith(1, mockArchives[0], {
        destinationDirectory: '/extracted/path',
        cleanBeforeExtract: false,
      });
      expect(mockExtractionService.extract).toHaveBeenNthCalledWith(2, mockArchives[1], {
        destinationDirectory: '/extracted/path',
        cleanBeforeExtract: false,
      });

      expect(result.totalArchivesDiscovered).toBe(2);
      expect(result.totalArchivesExtracted).toBe(2);
      expect(result.successfulExtractions).toBe(2);
      expect(result.failedExtractions).toBe(0);
      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          inputDirectory: '/input/path',
          extractionDirectory: '/extracted/path',
        }),
        'Workflow started',
      );
      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ totalArchivesDiscovered: 2 }),
        'Discovery completed',
      );
      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          totalArchivesExtracted: 2,
          successfulExtractions: 2,
          failedExtractions: 0,
        }),
        'Extraction completed',
      );
      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          totalArchivesDiscovered: 2,
          totalArchivesExtracted: 2,
          successfulExtractions: 2,
          failedExtractions: 0,
          success: true,
        }),
        'Workflow finished',
      );
    });

    it('should record archive failure, continue processing remaining archives, and return accurate summary', async () => {
      mockExtractionService.extract = vi
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('Corrupt zip header');
        })
        .mockImplementationOnce(async (archive: FileMetadata) => ({
          archiveName: archive.name,
          destinationPath: `/extracted/${archive.name}`,
          filesExtracted: [],
          durationMs: 5,
          success: true,
        }));

      const result = await orchestrator.execute();

      expect(mockExtractionService.extract).toHaveBeenCalledTimes(2);
      expect(result.totalArchivesDiscovered).toBe(2);
      expect(result.totalArchivesExtracted).toBe(2);
      expect(result.successfulExtractions).toBe(1);
      expect(result.failedExtractions).toBe(1);
      expect(result.success).toBe(false);
      expect(result.failures).toEqual([
        {
          archiveName: 'react-course.zip',
          error: 'Corrupt zip header',
        },
      ]);
    });

    it('should terminate and throw if discovery fails during workflow execution', async () => {
      mockDiscoveryService.discover = vi.fn().mockRejectedValue(new Error('Permission denied'));

      await expect(orchestrator.execute()).rejects.toThrow(IngestionError);
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ err: 'Permission denied' }),
        'Workflow failed during discovery stage',
      );
    });

    it('should terminate and rethrow AppError if discovery throws AppError during workflow execution', async () => {
      const notFoundErr = new NotFoundError('Input folder missing');
      mockDiscoveryService.discover = vi.fn().mockRejectedValue(notFoundErr);

      await expect(orchestrator.execute()).rejects.toThrow(NotFoundError);
    });
  });

  describe('run() alias', () => {
    it('should behave identically to execute()', async () => {
      const executeSpy = vi.spyOn(orchestrator, 'execute');
      const result = await orchestrator.run({ inputDirectory: '/test' });

      expect(executeSpy).toHaveBeenCalledWith({ inputDirectory: '/test' });
      expect(result.success).toBe(true);
    });
  });

  describe('embed() stage', () => {
    it('should run embedding service on chunking results and return embedding results', async () => {
      const mockEmbeddingService: IEmbeddingService = {
        embedChunks: vi.fn(),
        embedChunkingResult: vi.fn().mockResolvedValue({
          courseId: 'course-1',
          courseName: 'Test Course',
          providerName: 'Mistral',
          embeddingModel: 'mistral-embed',
          chunksCount: 5,
          embeddingsGeneratedCount: 5,
          failedChunksCount: 0,
          durationMs: 10,
          success: true,
          embeddedChunks: [],
          errors: [],
        }),
      };

      const customOrchestrator = new IngestionOrchestrator(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        mockEmbeddingService,
      );

      const chunkingResults = [
        {
          courseId: 'course-1',
          courseName: 'Test Course',
          lessonsCount: 1,
          transcriptsChunkedCount: 1,
          failedTranscriptsCount: 0,
          totalChunksCount: 5,
          averageChunkSize: 100,
          durationMs: 5,
          success: true,
          chunks: [{ id: 'chk-1', text: 'hello', metadata: { courseId: 'course-1', moduleId: 'm1', lessonId: 'l1', transcriptId: 't1' } }],
          transcriptResults: [],
          errors: [],
        },
      ];

      const res = await customOrchestrator.embed(chunkingResults);
      expect(res).toHaveLength(1);
      expect(res[0]?.embeddingsGeneratedCount).toBe(5);
      expect(mockEmbeddingService.embedChunkingResult).toHaveBeenCalledTimes(1);
    });
  });
});

