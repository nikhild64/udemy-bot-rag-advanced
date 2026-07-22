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

    // 4. Remove <head>, <script>, <style>, <noscript>, SVG, and HTML comments
    let bodyHtml = htmlStr
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');


    // Replace block elements with linebreaks to preserve readable paragraph layout
    bodyHtml = bodyHtml.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n');

    // Clean remaining tags
    const mainText = this.cleanText(bodyHtml);

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

  private cleanText(rawHtml?: string): string {
    if (!rawHtml) return '';
    return rawHtml
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
}
