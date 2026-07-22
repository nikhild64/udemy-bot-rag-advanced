import { SourceType } from '@prisma/client';
import { IDocumentExtractor } from './IDocumentExtractor';
import { TxtExtractor } from './TxtExtractor';
import { VttExtractor } from './VttExtractor';
import { PdfExtractor } from './PdfExtractor';
import { ValidationError } from '@/shared/errors';

export class ExtractorFactory {
  static getExtractor(type?: SourceType | string, mimeType?: string, fileName?: string): IDocumentExtractor {
    const ext = fileName ? fileName.split('.').pop()?.toLowerCase() || '' : '';
    const mime = mimeType?.toLowerCase() || '';
    const typeStr = (type || '').toString().toLowerCase();

    if (typeStr === 'pdf' || mime.includes('pdf') || ext === 'pdf') {
      return new PdfExtractor();
    }

    if (typeStr === 'vtt' || mime.includes('vtt') || ext === 'vtt') {
      return new VttExtractor();
    }

    if (
      typeStr === 'text' ||
      typeStr === 'txt' ||
      typeStr === 'markdown' ||
      mime.includes('text') ||
      mime.includes('json') ||
      (ext && ['txt', 'text', 'md', 'markdown', 'json'].includes(ext))
    ) {
      return new TxtExtractor();
    }

    // Default fallback to text extractor for text-based types, or throw ValidationError
    if (ext === 'txt' || ext === 'md' || !typeStr) {
      return new TxtExtractor();
    }

    const desc = (type || mimeType || fileName || 'unknown').toString();
    throw new ValidationError(`Unsupported source type or format for extraction: '${desc}'`);
  }
}
