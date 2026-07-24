import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export class HtmlExtractor implements IExtractor {
  async extract(
    input: RawContent | Buffer | string,
    mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument> {
    const startTime = Date.now();
    let htmlStr: string;
    let sourceMeta: Record<string, any> = {};

    if (typeof input === 'object' && 'content' in input && 'sourceId' in input) {
      const raw = input as RawContent;
      htmlStr = typeof raw.content === 'string' ? raw.content : raw.content.toString('utf-8');
      sourceMeta = raw.metadata || {};
    } else if (Buffer.isBuffer(input)) {
      htmlStr = input.toString('utf-8');
    } else if (typeof input === 'string') {
      htmlStr = input;
    } else {
      throw new ExtractionError('Invalid HTML extractor input: expected RawContent, Buffer, or string');
    }

    if (!htmlStr || htmlStr.trim().length === 0) {
      throw new ExtractionError('HTML content is empty');
    }

    logger.debug({ fileName, htmlLength: htmlStr.length }, 'Extracting content from HTML document');

    // 1. Extract page title from <title> tag
    const titleMatch = htmlStr.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? this.cleanText(titleMatch[1]) : (sourceMeta.title || fileName || 'Untitled Web Page');

    // 2. Extract meta author & language if available
    const authorMatch = htmlStr.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
    const langMatch = htmlStr.match(/<html[^>]*lang=["']([^"']+)["']/i);
    const author = authorMatch ? authorMatch[1] : sourceMeta.author;
    const language = langMatch ? langMatch[1] : sourceMeta.language;

    // 3. Extract headings
    const headings: string[] = [];
    const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = headingRegex.exec(htmlStr)) !== null) {
      const hText = this.cleanText(hMatch[1]);
      if (hText) headings.push(hText);
    }

    // 4. Extract and clean main body text
    const extractedContent = this.extractMainContent(htmlStr);
    const mainText = this.cleanText(extractedContent);

    if (!mainText) {
      throw new ExtractionError('Failed to extract text from HTML content');
    }

    const durationMs = Date.now() - startTime;
    logger.debug({ title: pageTitle, textLength: mainText.length, durationMs }, 'HTML content extracted successfully');

    const metadata: Record<string, any> = {
      ...sourceMeta,
      fileName,
      mimeType: mimeType || 'text/html',
      headings,
      ...(author ? { author } : {}),
      ...(language ? { language } : {}),
      charCount: mainText.length,
    };

    return {
      title: pageTitle,
      content: mainText,
      text: mainText,
      metadata,
    };
  }

  private extractMainContent(htmlStr: string): string {
    let clean = htmlStr
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '');

    // Preserve structure by mapping headings and block elements to linebreaks
    clean = clean
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, hText) => `\n\n### ${hText.replace(/<[^>]*>/g, '').trim()}\n\n`)
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|tr|br|section|article|li)>/gi, '\n');

    return clean;
  }

  private cleanText(rawHtml?: string): string {
    if (!rawHtml) return '';

    let text = rawHtml
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&copy;/gi, '©')
      .replace(/&ndash;|&mdash;/gi, '-');

    // Scrub inline JavaScript remnants, code runner snippets, and web boilerplate patterns
    text = text
      .replace(/\$\{html\}[\s\S]*?sourceURL=[^\n]*/gi, '')
      .replace(/jQuery\s*\([\s\S]*?\)\s*;?/gi, '')
      .replace(/document\s*\.\s*(?:querySelectorAll|querySelector|getElementById|addEventListener)[\s\S]*?\)\s*;?/gi, '')
      .replace(/localStorage\s*\.\s*(?:getItem|setItem)[\s\S]*?\)\s*;?/gi, '')
      .replace(/\/\/#\s*sourceURL=.*$/gm, '')
      .replace(/Skip to content/gi, '');

    // Clean whitespace and paragraph linebreaks
    text = text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n\n');

    return text.trim();
  }
}
