import { describe, it, expect, vi } from 'vitest';
import { WebsiteLoader } from '@/ingestion/loaders/WebsiteLoader';
import { SourceLoaderError } from '@/shared/errors';

describe('WebsiteLoader', () => {
  it('should fetch HTML content from a website URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/docs',
      text: async () => '<html><head><title>Example Docs</title></head><body><h1>Welcome</h1><p>Documentation body.</p></body></html>',
    });

    const loader = new WebsiteLoader({ fetchFn: mockFetch as any });

    const rawContent = await loader.load({
      id: 'web-1',
      notebookId: 'nb-1',
      type: 'WEBSITE',
      title: 'Example Documentation',
      fileUrl: 'https://example.com/docs',
    });

    expect(rawContent.sourceId).toBe('web-1');
    expect(rawContent.mimeType).toBe('text/html');
    expect(rawContent.content.toString()).toContain('Example Docs');
    expect(rawContent.metadata.url).toBe('https://example.com/docs');
  });

  it('should throw SourceLoaderError on HTTP 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const loader = new WebsiteLoader({ fetchFn: mockFetch as any });

    await expect(
      loader.load({
        id: 'web-404',
        notebookId: 'nb-1',
        type: 'WEBSITE',
        title: 'Missing Page',
        fileUrl: 'https://example.com/404',
      }),
    ).rejects.toThrow(SourceLoaderError);
  });

  it('should throw SourceLoaderError when missing target URL', async () => {
    const loader = new WebsiteLoader();
    await expect(
      loader.load({
        id: 'web-nourl',
        notebookId: 'nb-1',
        type: 'WEBSITE',
        title: 'No URL',
      }),
    ).rejects.toThrow(SourceLoaderError);
  });
});
