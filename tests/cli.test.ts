import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { runDiscover, runExtract } from '../src/cli';
import { IInputDiscoveryService, FileMetadata } from '../src/ingestion/discovery';
import { IExtractionService, ExtractionResult } from '../src/ingestion/extraction';

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
        discover: vi.fn().mockRejectedValue(new Error('Input directory not found')),
      };

      await expect(runDiscover(mockDiscoveryService)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Discovery failed:\n\nReason:\nInput directory not found',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('runExtract', () => {
    it('should discover archives, extract each, and print progress and destination folders', async () => {
      const mockArchives: FileMetadata[] = [
        { name: 'angular-course.zip', path: '/input/angular-course.zip', extension: '.zip', size: 1024, modifiedAt: new Date() },
        { name: 'react-course.zip', path: '/input/react-course.zip', extension: '.zip', size: 2048, modifiedAt: new Date() },
      ];

      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockResolvedValue(mockArchives),
      };

      const angularDestPath = path.resolve(process.cwd(), 'data/extracted/angular-course');
      const reactDestPath = path.resolve(process.cwd(), 'data/extracted/react-course');

      const mockExtractionService: IExtractionService = {
        extract: vi.fn().mockImplementation(async (archive: FileMetadata) => {
          if (archive.name === 'angular-course.zip') {
            return {
              archiveName: 'angular-course.zip',
              destinationPath: angularDestPath,
              filesExtracted: ['lesson1.vtt'],
              durationMs: 10,
              success: true,
            } as ExtractionResult;
          }
          return {
            archiveName: 'react-course.zip',
            destinationPath: reactDestPath,
            filesExtracted: ['lesson2.vtt'],
            durationMs: 12,
            success: true,
          } as ExtractionResult;
        }),
        extractAll: vi.fn(),
      };

      await runExtract(mockDiscoveryService, mockExtractionService);

      expect(logSpy).toHaveBeenCalledWith('Extracting...\n');
      expect(logSpy).toHaveBeenCalledWith('✓ angular-course.zip');
      expect(logSpy).toHaveBeenCalledWith('  → data/extracted/angular-course\n');
      expect(logSpy).toHaveBeenCalledWith('✓ react-course.zip');
      expect(logSpy).toHaveBeenCalledWith('  → data/extracted/react-course\n');
      expect(logSpy).toHaveBeenCalledWith('Extraction complete.');
    });

    it('should print error message with archive name and exit if extracting a specific archive fails', async () => {
      const mockArchives: FileMetadata[] = [
        { name: 'corrupt-course.zip', path: '/input/corrupt-course.zip', extension: '.zip', size: 1024, modifiedAt: new Date() },
      ];

      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockResolvedValue(mockArchives),
      };

      const mockExtractionService: IExtractionService = {
        extract: vi.fn().mockRejectedValue(new Error('Archive is corrupt.')),
        extractAll: vi.fn(),
      };

      await expect(runExtract(mockDiscoveryService, mockExtractionService)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Extraction failed:\n\ncorrupt-course.zip\n\nReason:\nArchive is corrupt.',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should print error message without archive name if discovery fails during extraction run', async () => {
      const mockDiscoveryService: IInputDiscoveryService = {
        discover: vi.fn().mockRejectedValue(new Error('Cannot access input folder.')),
      };

      const mockExtractionService: IExtractionService = {
        extract: vi.fn(),
        extractAll: vi.fn(),
      };

      await expect(runExtract(mockDiscoveryService, mockExtractionService)).rejects.toThrow('process.exit called with 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'Extraction failed:\n\nReason:\nCannot access input folder.',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
