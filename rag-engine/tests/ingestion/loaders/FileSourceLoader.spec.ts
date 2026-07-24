import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileSourceLoader } from '@/ingestion/loaders/FileSourceLoader';
import { SourceLoaderError } from '@/shared/errors';

describe('FileSourceLoader', () => {
  let loader: FileSourceLoader;
  let tempFilePath: string;

  beforeEach(async () => {
    const mockStorageService: any = {
      downloadFile: vi.fn().mockImplementation(async (p: string) => {
        if (p === 'remote/test.pdf') return Buffer.from('mock pdf content');
        throw new Error('File not found in storage');
      }),
    };

    loader = new FileSourceLoader(mockStorageService);

    // Create a temporary local file for local loading tests
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `test_file_${Date.now()}.txt`);
    await fs.writeFile(tempFilePath, 'Sample file content for FileSourceLoader unit test.');
  });

  it('should load content from a local file path', async () => {
    const rawContent = await loader.load({
      id: 'src-local-1',
      notebookId: 'nb-1',
      type: 'TEXT',
      title: 'Local Text File',
      storagePath: tempFilePath,
    });

    expect(rawContent.sourceId).toBe('src-local-1');
    expect(rawContent.mimeType).toBe('text/plain');
    expect(rawContent.content.toString()).toBe('Sample file content for FileSourceLoader unit test.');
    expect(rawContent.metadata.title).toBe('Local Text File');

    // Cleanup temp file
    await fs.unlink(tempFilePath).catch(() => {});
  });

  it('should load content from storage service when file is not local', async () => {
    const rawContent = await loader.load({
      id: 'src-remote-1',
      notebookId: 'nb-1',
      type: 'PDF',
      title: 'Remote PDF',
      storagePath: 'remote/test.pdf',
    });

    expect(rawContent.sourceId).toBe('src-remote-1');
    expect(rawContent.mimeType).toBe('application/pdf');
    expect(rawContent.content.toString()).toBe('mock pdf content');
  });

  it('should prefer the source file over stale derived rawText', async () => {
    const rawContent = await loader.load({
      id: 'src-stale-text-1',
      notebookId: 'nb-1',
      type: 'PDF',
      title: 'PDF with stale extraction',
      storagePath: 'remote/test.pdf',
      metadata: { rawText: '-- 1 of 43 --\n\n-- 2 of 43 --' },
    });

    expect(rawContent.content.toString()).toBe('mock pdf content');
  });

  it('should throw SourceLoaderError when missing storagePath and fileUrl', async () => {
    await expect(
      loader.load({
        id: 'src-invalid',
        notebookId: 'nb-1',
        type: 'TEXT',
        title: 'Invalid Source',
      }),
    ).rejects.toThrow(SourceLoaderError);
  });

  it('should throw SourceLoaderError when storageService fails to download', async () => {
    await expect(
      loader.load({
        id: 'src-missing',
        notebookId: 'nb-1',
        type: 'PDF',
        title: 'Missing Remote File',
        storagePath: 'nonexistent/file.pdf',
      }),
    ).rejects.toThrow(SourceLoaderError);
  });
});
