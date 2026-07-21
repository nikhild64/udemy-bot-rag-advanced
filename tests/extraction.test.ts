import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import extract from 'extract-zip';
import { ArchiveExtractor, ExtractionService } from '../src/ingestion/extraction';
import { NotFoundError, ValidationError, ExtractionError } from '../src/shared/errors';

vi.mock('node:fs/promises');
vi.mock('extract-zip');

const mockedFs = vi.mocked(fs);
const mockedExtract = vi.mocked(extract);

type ZipEntry = Parameters<NonNullable<extract.Options['onEntry']>>[0];
type ZipFileParam = Parameters<NonNullable<extract.Options['onEntry']>>[1];

describe('ArchiveExtractor', () => {
  let extractor: ArchiveExtractor;

  beforeEach(() => {
    extractor = new ArchiveExtractor();
    vi.resetAllMocks();
  });

  it('should extract ZIP archive successfully and preserve folder hierarchy', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 2048,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.mkdir.mockResolvedValue(undefined);

    mockedExtract.mockImplementation(async (_zipPath, opts) => {
      if (opts.onEntry) {
        const dummyZip = {} as unknown as ZipFileParam;
        opts.onEntry({ fileName: 'react-course/' } as unknown as ZipEntry, dummyZip);
        opts.onEntry({ fileName: 'react-course/module-1/lesson-1.vtt' } as unknown as ZipEntry, dummyZip);
        opts.onEntry({ fileName: 'react-course/module-1/notes.txt' } as unknown as ZipEntry, dummyZip);
      }
    });

    const result = await extractor.extract('/data/input/react-course.zip', '/data/extracted/react-course');

    expect(mockedFs.mkdir).toHaveBeenCalledWith(
      path.resolve('/data/extracted/react-course'),
      { recursive: true },
    );
    expect(mockedExtract).toHaveBeenCalledTimes(1);
    expect(result.archiveName).toBe('react-course.zip');
    expect(result.destinationPath).toBe(path.resolve('/data/extracted/react-course'));
    expect(result.filesExtracted).toEqual([
      'react-course/module-1/lesson-1.vtt',
      'react-course/module-1/notes.txt',
    ]);
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should throw NotFoundError if archive is missing', async () => {
    mockedFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    await expect(
      extractor.extract('/data/input/missing.zip', '/data/extracted/missing'),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError if archive is empty (0 bytes)', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 0,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);

    await expect(
      extractor.extract('/data/input/empty.zip', '/data/extracted/empty'),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError if archive has unsupported extension', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);

    await expect(
      extractor.extract('/data/input/doc.pdf', '/data/extracted/doc'),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ExtractionError if destination directory creation or access fails (permission error)', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockImplementation(async (targetPath) => {
      if (typeof targetPath === 'string' && targetPath.includes('extracted')) {
        throw new Error('EACCES: permission denied');
      }
    });

    await expect(
      extractor.extract('/data/input/course.zip', '/data/extracted/protected'),
    ).rejects.toThrow(ExtractionError);
  });

  it('should throw ValidationError when extract-zip throws corrupt zip error', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.mkdir.mockResolvedValue(undefined);

    mockedExtract.mockRejectedValue(new Error('end of central directory record not found (corrupt zip)'));

    await expect(
      extractor.extract('/data/input/corrupt.zip', '/data/extracted/corrupt'),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ExtractionError when extract-zip throws non-corrupt extraction failure', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.mkdir.mockResolvedValue(undefined);

    mockedExtract.mockRejectedValue(new Error('EPERM: operation not permitted'));

    await expect(
      extractor.extract('/data/input/course.zip', '/data/extracted/course'),
    ).rejects.toThrow(ExtractionError);
  });
});

describe('ExtractionService', () => {
  let service: ExtractionService;
  let mockExtractor: ArchiveExtractor;

  beforeEach(() => {
    mockExtractor = new ArchiveExtractor();
    service = new ExtractionService(mockExtractor, '/data/extracted');
    vi.resetAllMocks();
  });

  it('should orchestrate extraction, derive destination directory name, and clean existing directory before extraction', async () => {
    const mockExtractSpy = vi.spyOn(mockExtractor, 'extract').mockResolvedValue({
      archiveName: 'react-course.zip',
      destinationPath: path.resolve('/data/extracted/react-course'),
      filesExtracted: ['react-course/lesson-1.vtt'],
      durationMs: 15,
      success: true,
    });

    mockedFs.rm.mockResolvedValue(undefined);

    const result = await service.extract('/data/input/react-course.zip');

    expect(mockedFs.rm).toHaveBeenCalledWith(path.resolve('/data/extracted/react-course'), {
      recursive: true,
      force: true,
    });
    expect(mockExtractSpy).toHaveBeenCalledWith(
      path.resolve('/data/input/react-course.zip'),
      path.resolve('/data/extracted/react-course'),
    );
    expect(result.archiveName).toBe('react-course.zip');
    expect(result.filesExtracted).toEqual(['react-course/lesson-1.vtt']);
  });

  it('should skip cleaning when cleanBeforeExtract option is false', async () => {
    const mockExtractSpy = vi.spyOn(mockExtractor, 'extract').mockResolvedValue({
      archiveName: 'angular-course.zip',
      destinationPath: path.resolve('/data/extracted/angular-course'),
      filesExtracted: ['angular-course/lesson.vtt'],
      durationMs: 10,
      success: true,
    });

    const result = await service.extract('/data/input/angular-course.zip', {
      cleanBeforeExtract: false,
    });

    expect(mockedFs.rm).not.toHaveBeenCalled();
    expect(mockExtractSpy).toHaveBeenCalled();
    expect(result.archiveName).toBe('angular-course.zip');
  });

  it('should throw ExtractionError if cleaning destination directory fails', async () => {
    mockedFs.rm.mockRejectedValue(new Error('EACCES: permission denied during rm'));

    await expect(service.extract('/data/input/locked-course.zip')).rejects.toThrow(
      ExtractionError,
    );
  });

  it('should accept FileMetadata object as input and use custom destinationDirectory option', async () => {
    const mockExtractSpy = vi.spyOn(mockExtractor, 'extract').mockResolvedValue({
      archiveName: 'docker-course.zip',
      destinationPath: path.resolve('/custom/dest/docker-course'),
      filesExtracted: ['docker-course/intro.vtt'],
      durationMs: 20,
      success: true,
    });

    mockedFs.rm.mockResolvedValue(undefined);

    const fileMetadata = {
      name: 'docker-course.zip',
      path: '/data/input/docker-course.zip',
      extension: '.zip',
      size: 4096,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    const result = await service.extract(fileMetadata, {
      destinationDirectory: '/custom/dest',
    });

    expect(mockedFs.rm).toHaveBeenCalledWith(path.resolve('/custom/dest/docker-course'), {
      recursive: true,
      force: true,
    });
    expect(mockExtractSpy).toHaveBeenCalledWith(
      path.resolve('/data/input/docker-course.zip'),
      path.resolve('/custom/dest/docker-course'),
    );
    expect(result.destinationPath).toBe(path.resolve('/custom/dest/docker-course'));
  });

  it('should extract all provided archives when calling extractAll', async () => {
    vi.spyOn(mockExtractor, 'extract').mockImplementation(async (archivePath, destPath) => ({
      archiveName: path.basename(archivePath),
      destinationPath: destPath,
      filesExtracted: ['lesson.vtt'],
      durationMs: 5,
      success: true,
    }));

    mockedFs.rm.mockResolvedValue(undefined);

    const archives = ['/data/input/course1.zip', '/data/input/course2.zip'];
    const results = await service.extractAll(archives);

    expect(results).toHaveLength(2);
    expect(results[0]?.archiveName).toBe('course1.zip');
    expect(results[1]?.archiveName).toBe('course2.zip');
  });
});
