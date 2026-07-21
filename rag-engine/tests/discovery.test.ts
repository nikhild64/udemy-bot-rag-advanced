import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ArchiveInspector, InputDiscoveryService } from '../src/ingestion/discovery';
import { NotFoundError, ValidationError } from '../src/shared/errors';

vi.mock('node:fs/promises');
const mockedFs = vi.mocked(fs);

describe('ArchiveInspector', () => {
  let inspector: ArchiveInspector;

  beforeEach(() => {
    inspector = new ArchiveInspector();
    vi.resetAllMocks();
  });

  it('should throw NotFoundError if file does not exist', async () => {
    mockedFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    await expect(inspector.validate('/data/input/missing.zip')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('should throw ValidationError if file extension is unsupported', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);

    await expect(inspector.validate('/data/input/notes.txt')).rejects.toThrow(
      ValidationError,
    );
  });

  it('should throw ValidationError if file is not readable', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

    await expect(inspector.validate('/data/input/course.zip')).rejects.toThrow(
      ValidationError,
    );
  });

  it('should throw ValidationError if archive size is 0', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 0,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-02'),
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);

    await expect(inspector.validate('/data/input/empty.zip')).rejects.toThrow(
      ValidationError,
    );
  });

  it('should inspect valid zip archive and return metadata', async () => {
    const birthtime = new Date('2026-01-01T10:00:00Z');
    const mtime = new Date('2026-01-02T10:00:00Z');

    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 2048576,
      birthtime,
      mtime,
    } as unknown as fs.Stats);
    mockedFs.access.mockResolvedValue(undefined);

    const metadata = await inspector.inspect('/data/input/course.zip');

    expect(metadata.name).toBe('course.zip');
    expect(metadata.path).toBe(path.resolve('/data/input/course.zip'));
    expect(metadata.extension).toBe('.zip');
    expect(metadata.size).toBe(2048576);
    expect(metadata.createdAt).toEqual(birthtime);
    expect(metadata.modifiedAt).toEqual(mtime);
  });
});

describe('InputDiscoveryService', () => {
  let service: InputDiscoveryService;
  let inspector: ArchiveInspector;

  beforeEach(() => {
    inspector = new ArchiveInspector();
    service = new InputDiscoveryService(inspector, '/mock/input');
    vi.resetAllMocks();
  });

  it('should throw NotFoundError when missing directory', async () => {
    mockedFs.stat.mockRejectedValue(new Error('ENOENT: no such directory'));

    await expect(service.discover()).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when path is not a directory', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false,
    } as unknown as fs.Stats);

    await expect(service.discover()).rejects.toThrow(NotFoundError);
  });

  it('should return empty array for an empty directory', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => true,
    } as unknown as fs.Stats);
    mockedFs.readdir.mockResolvedValue([]);

    const results = await service.discover();
    expect(results).toEqual([]);
  });

  it('should ignore hidden files and directories', async () => {
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => true,
    } as unknown as fs.Stats);

    mockedFs.readdir.mockResolvedValue([
      { name: '.gitkeep', isDirectory: () => false } as unknown as fs.Dirent,
      { name: '.DS_Store', isDirectory: () => false } as unknown as fs.Dirent,
      { name: 'subdir', isDirectory: () => true } as unknown as fs.Dirent,
    ]);

    const results = await service.discover();
    expect(results).toEqual([]);
    expect(mockedFs.stat).toHaveBeenCalledTimes(1); // Only for directory check
  });

  it('should ignore unsupported files while continuing discovery', async () => {
    mockedFs.stat.mockImplementation(async (filePath) => {
      if (filePath === '/mock/input') {
        return { isDirectory: () => true } as unknown as fs.Stats;
      }
      if (typeof filePath === 'string' && filePath.endsWith('.zip')) {
        return {
          isDirectory: () => false,
          size: 1024,
          birthtime: new Date(),
          mtime: new Date(),
        } as unknown as fs.Stats;
      }
      return {
        isDirectory: () => false,
        size: 512,
        birthtime: new Date(),
        mtime: new Date(),
      } as unknown as fs.Stats;
    });

    mockedFs.access.mockResolvedValue(undefined);

    mockedFs.readdir.mockResolvedValue([
      { name: 'notes.txt', isDirectory: () => false } as unknown as fs.Dirent,
      { name: 'manual.pdf', isDirectory: () => false } as unknown as fs.Dirent,
      { name: 'valid-course.zip', isDirectory: () => false } as unknown as fs.Dirent,
    ]);

    const results = await service.discover();
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('valid-course.zip');
  });

  it('should discover multiple ZIP files', async () => {
    mockedFs.stat.mockImplementation(async (filePath) => {
      if (filePath === '/mock/input') {
        return { isDirectory: () => true } as unknown as fs.Stats;
      }
      return {
        isDirectory: () => false,
        size: 5000,
        birthtime: new Date('2026-05-01'),
        mtime: new Date('2026-05-02'),
      } as unknown as fs.Stats;
    });

    mockedFs.access.mockResolvedValue(undefined);

    mockedFs.readdir.mockResolvedValue([
      { name: 'course1.zip', isDirectory: () => false } as unknown as fs.Dirent,
      { name: 'course2.zip', isDirectory: () => false } as unknown as fs.Dirent,
    ]);

    const results = await service.discover();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name)).toEqual(['course1.zip', 'course2.zip']);
  });
});
