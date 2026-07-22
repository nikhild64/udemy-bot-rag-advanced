import fs from 'node:fs/promises';
import { ISourceLoader, SourceInput } from './ISourceLoader';
import { RawContent } from './RawContent';
import { StorageService } from '@/services/StorageService';
import { SourceLoaderError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export interface WebsiteLoaderOptions {
  timeoutMs?: number | undefined;
  fetchFn?: typeof fetch | undefined;
  storageService?: StorageService | undefined;
}

export class WebsiteLoader implements ISourceLoader {
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly storageService: StorageService;

  constructor(options: WebsiteLoaderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.storageService = options.storageService ?? new StorageService();
  }

  async load(source: SourceInput): Promise<RawContent> {
    const startTime = Date.now();
    const targetUrl = source.fileUrl || source.metadata?.url || source.storagePath;

    logger.info(
      { sourceId: source.id, notebookId: source.notebookId, loader: 'WebsiteLoader', targetUrl },
      'Loading website content',
    );

    if (!targetUrl) {
      throw new SourceLoaderError(`Website source '${source.id}' is missing a target URL or storagePath`);
    }

    let htmlContent: string;
    let finalUrl = targetUrl;

    if (/^https?:\/\//i.test(targetUrl)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await this.fetchFn(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (RAG-Ingestion-Bot/1.0)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new SourceLoaderError(
            `Failed to fetch website URL '${targetUrl}': HTTP status ${response.status} ${response.statusText}`,
          );
        }

        htmlContent = await response.text();
        finalUrl = response.url || targetUrl;
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(
          { sourceId: source.id, notebookId: source.notebookId, loader: 'WebsiteLoader', url: targetUrl, error: errorMsg, durationMs },
          'Website fetch failed',
        );
        if (err instanceof SourceLoaderError) {
          throw err;
        }
        throw new SourceLoaderError(`Network error while fetching website '${targetUrl}': ${errorMsg}`, { cause: err });
      }
    } else {
      try {
        if (await this.isLocalFile(targetUrl)) {
          const buf = await fs.readFile(targetUrl);
          htmlContent = buf.toString('utf-8');
        } else if (source.storagePath) {
          const buf = await this.storageService.downloadFile(source.storagePath);
          htmlContent = buf.toString('utf-8');
        } else {
          throw new SourceLoaderError(`Invalid URL or file path for website source '${source.id}': '${targetUrl}'`);
        }
      } catch (err: any) {
        if (err instanceof SourceLoaderError) throw err;
        throw new SourceLoaderError(`Failed to read website content from path '${targetUrl}': ${err.message}`, { cause: err });
      }
    }

    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new SourceLoaderError(`Fetched empty HTML content from website '${targetUrl}'`);
    }

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        sourceId: source.id,
        notebookId: source.notebookId,
        loader: 'WebsiteLoader',
        url: finalUrl,
        sizeBytes: Buffer.byteLength(htmlContent, 'utf-8'),
        durationMs,
      },
      'Loaded website content successfully',
    );

    return {
      sourceId: source.id,
      sourceType: String(source.type),
      mimeType: 'text/html',
      content: htmlContent,
      metadata: {
        title: source.title,
        displayName: source.displayName,
        url: finalUrl,
        loadedAt: new Date().toISOString(),
        ...(source.metadata || {}),
      },
    };
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
