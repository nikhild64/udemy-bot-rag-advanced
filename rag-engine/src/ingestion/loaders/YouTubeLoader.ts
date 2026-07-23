import fs from 'node:fs/promises';
import { YoutubeTranscript } from 'youtube-transcript';
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
    const mimeType = 'text/plain';

    // 1. If storagePath points to a saved VTT or TXT transcript file
    if (source.storagePath) {
      try {
        if (await this.isLocalFile(source.storagePath)) {
          content = await fs.readFile(source.storagePath);
        } else {
          content = await this.storageService.downloadFile(source.storagePath);
        }
      } catch (err: any) {
        logger.warn({ sourceId: source.id, storagePath: source.storagePath, err: err.message }, 'Failed to read storagePath for YouTube source, attempting transcript fetch');
      }
    }

    // 2. If content is present directly in metadata (e.g. metadata.transcript)
    if (!content && source.metadata?.transcript) {
      content = String(source.metadata.transcript);
    }

    // 3. Primary: Use youtube-transcript package (most reliable, handles consent + auto-captions)
    if (!content && videoId) {
      const transcriptText = await this.fetchTranscriptViaPackage(videoId, source.title);
      if (transcriptText) {
        content = transcriptText;
      }
    }

    // 4. Fallback: YouTube InnerTube JSON API
    if (!content && videoId) {
      const innerTubeTranscript = await this.fetchTranscriptFromInnerTube(videoId, source.title || `YouTube Video ${videoId}`);
      if (innerTubeTranscript) {
        content = innerTubeTranscript;
      }
    }

    // 5. Last resort: fetch page HTML and extract what we can
    if (!content && videoId) {
      try {
        const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await this.fetchFn(videoPageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
        });

        if (response.ok) {
          const html = await response.text();
          const extracted = await this.extractTranscriptFromHtml(html, source.title || `YouTube Video ${videoId}`, videoId);
          content = extracted;
        } else {
          content = `YouTube Video\nTitle: ${source.title}\nVideo ID: ${videoId}`;
        }
      } catch (fetchErr: any) {
        logger.warn({ videoId, error: fetchErr.message }, 'Could not fetch YouTube web page, using title fallback');
        content = `YouTube Video\nTitle: ${source.title}\nVideo ID: ${videoId}`;
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
        contentLength: typeof content === 'string' ? content.length : content.byteLength,
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
   * Primary method: uses the youtube-transcript npm package.
   * Handles auto-captions, manual subtitles, and consent walls automatically.
   */
  private async fetchTranscriptViaPackage(videoId: string, defaultTitle?: string | null): Promise<string | null> {
    const title = defaultTitle || `YouTube Video ${videoId}`;

    const buildResult = (items: { text: string; offset?: number }[], lang: string): string | null => {
      const text = items.map((item) => {
        let prefix = '';
        if (typeof item.offset === 'number') {
          const totalSeconds = Math.floor(item.offset / 1000);
          const hh = Math.floor(totalSeconds / 3600);
          const mm = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
          const ss = (totalSeconds % 60).toString().padStart(2, '0');
          prefix = hh > 0 ? `[${hh}:${mm}:${ss}] ` : `[${mm}:${ss}] `;
        }
        return `${prefix}${item.text.trim()}`;
      }).filter((t) => t.length > 7).join('\n');
      
      if (text.length === 0) return null;
      logger.info({ videoId, lang, segments: items.length, transcriptLength: text.length }, 'Fetched YouTube transcript via youtube-transcript package');
      return `YouTube Video Transcript\nTitle: ${title}\nVideo ID: ${videoId}\n\nTranscript:\n${text}`;
    };

    // 1. Try English first
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
      if (items && items.length > 0) return buildResult(items, 'en');
    } catch (enErr: any) {
      logger.info({ videoId, error: enErr.message }, 'English transcript not available, trying auto-detected language');

      // Parse available languages from the error message
      // Error format: "No transcripts are available in en this video (ID). Available languages: hi, en-US"
      const langMatch = enErr.message?.match(/Available languages:\s*([^\s].+)/i);
      if (langMatch && langMatch[1]) {
        const availableLangs = langMatch[1]
          .split(',')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0);

        for (const lang of availableLangs) {
          try {
            const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
            if (items && items.length > 0) return buildResult(items, lang);
          } catch {
            // try next lang
          }
        }
      }
    }

    // 2. Try without any lang filter (let the package pick any available)
    try {
      const items = await YoutubeTranscript.fetchTranscript(videoId);
      if (items && items.length > 0) return buildResult(items, 'auto');
    } catch (anyErr: any) {
      logger.warn({ videoId, error: anyErr.message }, 'youtube-transcript package failed all attempts, will try InnerTube API fallback');
    }

    return null;
  }

  /**
   * Fallback: YouTube InnerTube JSON API POST request.
   */
  private async fetchTranscriptFromInnerTube(videoId: string, defaultTitle: string): Promise<string | null> {
    try {
      const response = await this.fetchFn('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          videoId: videoId,
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
              hl: 'en',
              gl: 'US',
            },
          },
        }),
      });

      if (!response.ok) return null;

      const playerResponse = (await response.json()) as any;
      const videoTitle = playerResponse?.videoDetails?.title || defaultTitle;
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (Array.isArray(tracks) && tracks.length > 0) {
        const targetTrack = tracks.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];
        if (targetTrack && targetTrack.baseUrl) {
          const xmlRes = await this.fetchFn(targetTrack.baseUrl);
          if (xmlRes.ok) {
            const xmlText = await xmlRes.text();
            const lines = this.parseTimedText(xmlText);
            if (lines.length > 0) {
              const fullTranscript = lines.join(' ');
              logger.info({ videoId, linesCount: lines.length, transcriptLength: fullTranscript.length }, 'Fetched YouTube transcript via InnerTube API');
              return `YouTube Video Transcript\nTitle: ${videoTitle}\nVideo ID: ${videoId}\n\nTranscript:\n${fullTranscript}`;
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn({ videoId, error: err.message }, 'InnerTube API transcript fetch failed');
    }

    return null;
  }

  /**
   * Parse YouTube timed-text XML into plain text lines.
   */
  private parseTimedText(xmlText: string): string[] {
    const textMatches = Array.from(xmlText.matchAll(/<text[^>]*>(.*?)<\/text>/gi));
    return textMatches
      .map((m) =>
        (m[1] || '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/<[^>]+>/g, '')
          .trim(),
      )
      .filter((line) => line.length > 0);
  }

  /**
   * Extract title and attempt timedtext from YouTube HTML as last resort.
   */
  private async extractTranscriptFromHtml(html: string, defaultTitle: string, videoId: string): Promise<string> {
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const videoTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace('- YouTube', '').trim() : defaultTitle;

    // Try direct timedtext endpoint
    try {
      const directRes = await this.fetchFn(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`);
      if (directRes.ok) {
        const xmlText = await directRes.text();
        const lines = this.parseTimedText(xmlText);
        if (lines.length > 0) {
          const fullTranscript = lines.join(' ');
          logger.info({ videoId, linesCount: lines.length }, 'Fetched transcript via timedtext API fallback');
          return `YouTube Video Transcript\nTitle: ${videoTitle}\nVideo ID: ${videoId}\n\nTranscript:\n${fullTranscript}`;
        }
      }
    } catch {
      // fall through
    }

    logger.warn({ videoId }, 'No transcript available for YouTube video, using title-only fallback');
    return `YouTube Video Transcript\nTitle: ${videoTitle}\nVideo ID: ${videoId}\n\nContent:\n${videoTitle}`;
  }

  /**
   * Extract 11-character YouTube video ID from various URL formats.
   */
  public extractVideoId(urlOrId?: string | null): string | null {
    if (!urlOrId) return null;
    const trimmed = urlOrId.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmed.match(regex);
    return match && match[1] ? match[1] : null;
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
