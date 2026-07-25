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
    // 1. Target <main>, <article>, or [role="main"] using stack-aware tag matching if present
    let content =
      this.findMatchingElementContent(htmlStr, 'main') ||
      this.findMatchingElementContent(htmlStr, 'article') ||
      this.findMatchingElementContent(htmlStr, 'body') ||
      htmlStr;

    // Ensure extracted content isn't empty
    if (!content || content.trim().length < 50) {
      content = htmlStr;
    }

    // Include <h1> heading from <header> if present outside <main>
    const headerMatch = htmlStr.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
    if (headerMatch && headerMatch[1] && !content.includes(headerMatch[1])) {
      const h1Match = headerMatch[1].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      if (h1Match && h1Match[1]) {
        content = `<h1>${h1Match[1]}</h1>\n` + content;
      }
    }

    // 2. Strip non-content elements, scripts, styles, nav, aside, footer, buttons, forms, inputs
    let clean = content
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<button[\s\S]*?<\/button>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/<select[\s\S]*?<\/select>/gi, '')
      .replace(/<input[^>]*>/gi, '');

    // Strip skip-to-content anchor tags specifically
    clean = clean.replace(/<a[^>]*class=["'][^"']*\bskip-[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
    clean = clean.replace(/<a[^>]*href=["']#main[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');

    // Preserve structure by mapping headings and block elements to linebreaks
    clean = clean
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, hText) => `\n\n### ${hText.replace(/<[^>]*>/g, '').trim()}\n\n`)
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|tr|br|section|article|li)>/gi, '\n');

    return clean;
  }

  private findMatchingElementContent(html: string, tagName: string): string | null {
    const openTagRegex = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'i');
    const match = openTagRegex.exec(html);
    if (!match) return null;

    const startIndex = match.index + match[0].length;
    let depth = 1;
    const tagRegex = new RegExp(`</?${tagName}(?:\\s[^>]*)?>`, 'gi');
    tagRegex.lastIndex = startIndex;

    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(html)) !== null) {
      if (m[0].startsWith('</')) {
        depth--;
        if (depth === 0) {
          return html.substring(startIndex, m.index);
        }
      } else {
        depth++;
      }
    }

    const endMatch = new RegExp(`</${tagName}>`, 'i').exec(html.substring(startIndex));
    if (endMatch) {
      return html.substring(startIndex, startIndex + endMatch.index);
    }

    return null;
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
      .replace(/\b(arrow_back|expand_more|expand_less|chevron_right|chevron_left)\b/gi, '');

    // Clean whitespace and paragraph linebreaks
    const lines = text
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 0);

    // Filter out boilerplate navigation noise lines and orphan bullets
    const filteredLines = lines.filter((line) => {
      const lower = line.toLowerCase();
      if (lower.includes('skip to main content') || lower.includes('skip to content')) return false;
      if (lower === 'menu docs' || lower === 'menu' || lower === 'menu docs •' || lower.startsWith('menu docs')) return false;
      if (line === '•' || line === '-' || line === '*') return false;
      return true;
    });

    return filteredLines.join('\n\n').trim();
  }
}
