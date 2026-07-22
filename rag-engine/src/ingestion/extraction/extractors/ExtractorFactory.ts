import { SourceType } from '@prisma/client';
import { IExtractor } from './IExtractor';
import { TxtExtractor } from './TxtExtractor';
import { VttExtractor } from './VttExtractor';
import { PdfExtractor } from './PdfExtractor';
import { HtmlExtractor } from './HtmlExtractor';
import { RawContent } from '../../loaders/RawContent';
import { ValidationError } from '@/shared/errors';

export class ExtractorFactory {
  /**
   * Resolves and returns an IExtractor instance based on input type, mimeType, filename, or RawContent object.
   */
  static getExtractor(
    typeOrRaw?: SourceType | string | RawContent | null,
    mimeType?: string | null,
    fileName?: string | null,
  ): IExtractor {
    let typeStr = '';
    let mimeStr = mimeType?.toLowerCase() || '';
    let fileStr = fileName || '';

    if (typeOrRaw && typeof typeOrRaw === 'object' && 'mimeType' in typeOrRaw) {
      const raw = typeOrRaw as RawContent;
      typeStr = String(raw.sourceType || '').toLowerCase();
      mimeStr = String(raw.mimeType || '').toLowerCase();
      fileStr = String(raw.metadata?.fileName || raw.metadata?.storagePath || raw.metadata?.url || '');
    } else if (typeOrRaw) {
      typeStr = String(typeOrRaw).toLowerCase();
    }

    const ext = fileStr ? fileStr.split('.').pop()?.toLowerCase() || '' : '';

    if (typeStr === 'pdf' || mimeStr.includes('pdf') || ext === 'pdf') {
      return new PdfExtractor();
    }

    if (typeStr === 'vtt' || mimeStr.includes('vtt') || ext === 'vtt') {
      return new VttExtractor();
    }

    if (
      typeStr === 'website' ||
      typeStr === 'html' ||
      mimeStr.includes('html') ||
      mimeStr.includes('xhtml') ||
      ext === 'html' ||
      ext === 'htm'
    ) {
      return new HtmlExtractor();
    }

    if (
      typeStr === 'text' ||
      typeStr === 'txt' ||
      typeStr === 'markdown' ||
      typeStr === 'youtube' ||
      mimeStr.includes('text') ||
      mimeStr.includes('json') ||
      ['txt', 'text', 'md', 'markdown', 'json'].includes(ext)
    ) {
      return new TxtExtractor();
    }

    // Default fallback to TxtExtractor for text-based types, or throw ValidationError if unsupported
    if (ext === 'txt' || ext === 'md' || !typeStr) {
      return new TxtExtractor();
    }

    const desc = typeStr || mimeStr || fileStr || 'unknown';
    throw new ValidationError(`Unsupported source type or format for extraction: '${desc}'`);
  }
}
