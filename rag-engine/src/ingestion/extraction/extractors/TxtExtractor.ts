import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';

export class TxtExtractor implements IExtractor {
  async extract(
    input: RawContent | Buffer | string,
    mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument> {
    let text: string;
    let title = fileName || 'Untitled Document';
    let sourceMeta: Record<string, any> = {};

    if (typeof input === 'object' && 'content' in input && 'sourceId' in input) {
      const raw = input as RawContent;
      text = typeof raw.content === 'string' ? raw.content : raw.content.toString('utf-8');
      title = raw.metadata?.title || fileName || 'Untitled Document';
      sourceMeta = raw.metadata || {};
    } else if (Buffer.isBuffer(input)) {
      text = input.toString('utf-8');
    } else if (typeof input === 'string') {
      text = input;
    } else {
      throw new ExtractionError('Invalid Text extractor input: expected RawContent, Buffer, or string');
    }

    const metadata: Record<string, any> = {
      ...sourceMeta,
      fileName,
      mimeType: mimeType || 'text/plain',
      charCount: text.length,
    };

    return {
      title,
      content: text,
      text,
      metadata,
    };
  }
}
