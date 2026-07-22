import { describe, it, expect, vi } from 'vitest';
import { YouTubeLoader } from '@/ingestion/loaders/YouTubeLoader';
import { SourceLoaderError } from '@/shared/errors';

describe('YouTubeLoader', () => {
  it('should extract video ID correctly from various URL formats', () => {
    const loader = new YouTubeLoader();

    expect(loader.extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(loader.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(loader.extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(loader.extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should load YouTube content given a video URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Never Gonna Give You Up - YouTube</title></head><body>...</body></html>',
    });

    const loader = new YouTubeLoader({ fetchFn: mockFetch as any });

    const rawContent = await loader.load({
      id: 'yt-1',
      notebookId: 'nb-1',
      type: 'YOUTUBE',
      title: 'Rick Astley - Never Gonna Give You Up',
      fileUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });

    expect(rawContent.sourceId).toBe('yt-1');
    expect(rawContent.metadata.videoId).toBe('dQw4w9WgXcQ');
    expect(rawContent.metadata.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(rawContent.content.toString()).toContain('Never Gonna Give You Up');
  });

  it('should throw SourceLoaderError when missing video URL and ID', async () => {
    const loader = new YouTubeLoader();

    await expect(
      loader.load({
        id: 'yt-invalid',
        notebookId: 'nb-1',
        type: 'YOUTUBE',
        title: 'No Video ID',
      }),
    ).rejects.toThrow(SourceLoaderError);
  });
});
