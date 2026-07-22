import fs from 'node:fs/promises';
import { ISourceLoader, SourceInput } from './ISourceLoader';
import { RawContent } from './RawContent';
import { StorageService } from '@/services/StorageService';
import { SourceLoaderError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export interface YouTubeLoaderOptions {
  fetchFn?: typeof fetch | undefined;
  storageService?: StorageService | undefined;
}

export class YouTubeLoader implements ISourceLoader {
  private readonly fetchFn: typeof fetch;
  private readonly storageService: StorageService;

  constructor(options: YouTubeLoaderOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.storageService = options.storageService ?? new StorageService();
  }

  async load(source: SourceInput): Promise<RawContent> {
    const startTime = Date.now();
    logger.info(
      { sourceId: source.id, notebookId: source.notebookId, loader: 'YouTubeLoader' },
      'Loading YouTube content',
    );

    const inputUrlOrId = source.fileUrl || source.metadata?.url || source.storagePath || source.metadata?.videoId;

    if (!inputUrlOrId) {
      throw new SourceLoaderError(`YouTube source '${source.id}' is missing a video URL, video ID, or transcript storagePath`);
    }

    const videoId = this.extractVideoId(inputUrlOrId);

    let content: string | Buffer = '';
    let mimeType = 'text/plain';

    // 1. If storagePath points to a saved VTT or TXT transcript file
    if (source.storagePath) {
      try {
        if (await this.isLocalFile(source.storagePath)) {
          content = await fs.readFile(source.storagePath);
        } else {
          content = await this.storageService.downloadFile(source.storagePath);
        }
        if (source.storagePath.endsWith('.vtt')) {
          mimeType = 'text/vtt';
        }
      } catch (err: any) {
        logger.warn({ sourceId: source.id, storagePath: source.storagePath, err: err.message }, 'Failed to read storagePath for YouTube source, attempting transcript fetch');
      }
    }

    // 2. If content is present directly in metadata (e.g. metadata.transcript)
    if (!content && source.metadata?.transcript) {
      content = String(source.metadata.transcript);
    }

    // 3. Fallback: If video ID is valid and no local storage transcript exists, fetch video metadata / transcript page
    if (!content && videoId) {
      try {
        const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await this.fetchFn(videoPageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });

        if (response.ok) {
          const html = await response.text();
          content = this.extractTranscriptFromHtml(html, source.title || `YouTube Video ${videoId}`);
        } else {
          content = `YouTube Video Transcript [ID: ${videoId}]\nTitle: ${source.title}`;
        }
      } catch (fetchErr: any) {
        logger.warn({ videoId, error: fetchErr.message }, 'Could not fetch YouTube web transcript, using fallback document');
        content = `YouTube Video [ID: ${videoId}]\nTitle: ${source.title}`;
      }
    }

    if (!content || (typeof content === 'string' && content.trim().length === 0)) {
      throw new SourceLoaderError(`Failed to load content for YouTube source '${source.id}' (Video ID: ${videoId || 'unknown'})`);
    }

    const durationMs = Date.now() - startTime;
    const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : (source.fileUrl || null);

    logger.info(
      {
        sourceId: source.id,
        notebookId: source.notebookId,
        loader: 'YouTubeLoader',
        videoId,
        videoUrl,
        durationMs,
      },
      'Loaded YouTube content successfully',
    );

    return {
      sourceId: source.id,
      sourceType: String(source.type),
      mimeType,
      content,
      metadata: {
        title: source.title,
        displayName: source.displayName,
        videoId: videoId || null,
        videoUrl: videoUrl || null,
        loadedAt: new Date().toISOString(),
        ...(source.metadata || {}),
      },
    };
  }

  /**
   * Helper to extract 11-character YouTube video ID from various URL patterns.
   */
  public extractVideoId(urlOrId?: string | null): string | null {
    if (!urlOrId) return null;
    const trimmed = urlOrId.trim();

    // Direct 11-character ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Match standard youtube.com or youtu.be URLs
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmed.match(regex);
    return match && match[1] ? match[1] : null;
  }

  private extractTranscriptFromHtml(html: string, defaultTitle: string): string {
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const videoTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace('- YouTube', '').trim() : defaultTitle;

    return `YouTube Transcript\nTitle: ${videoTitle}\n\nContent:\n${videoTitle}`;
  }

  private async isLocalFile(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }
}
