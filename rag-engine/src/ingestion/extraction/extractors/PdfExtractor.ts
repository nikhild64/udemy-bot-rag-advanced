import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';

export class PdfExtractor implements IExtractor {
  async extract(
    input: RawContent | Buffer | string,
    mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument> {
    let fileBuffer: Buffer;
    let title = fileName || 'Untitled PDF';
    let sourceMeta: Record<string, any> = {};

    if (typeof input === 'object' && 'content' in input && 'sourceId' in input) {
      const raw = input as RawContent;
      fileBuffer = Buffer.isBuffer(raw.content) ? raw.content : Buffer.from(raw.content);
      title = raw.metadata?.title || fileName || 'Untitled PDF';
      sourceMeta = raw.metadata || {};
    } else if (Buffer.isBuffer(input)) {
      fileBuffer = input;
    } else if (typeof input === 'string') {
      fileBuffer = Buffer.from(input);
    } else {
      throw new ExtractionError('Invalid PDF extractor input: expected RawContent, Buffer, or string');
    }

    const contentStr = fileBuffer.toString('utf-8');
    const binaryStr = fileBuffer.toString('latin1');
    const textPieces: string[] = [];

    // 1. Extract text from Tj / TJ operators in PDF streams
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(contentStr)) !== null) {
      if (match[1]) {
        textPieces.push(match[1]);
      }
    }

    // Array TJ operators: [(Hello) 10 (World)] TJ
    const arrayTjRegex = /\[((?:[^\]]+))\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(contentStr)) !== null) {
      if (match[1]) {
        const innerStr = match[1];
        const innerPieces = innerStr.match(/\(([^)]+)\)/g);
        if (innerPieces) {
          innerPieces.forEach((p) => {
            textPieces.push(p.replace(/^\(|\)$/g, ''));
          });
        }
      }
    }

    // 2. Fallback scan if stream text operators weren't matched
    let extractedText = textPieces.join(' ').trim();
    if (!extractedText || extractedText.length < 10) {
      const cleanAscii = binaryStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      const words = cleanAscii.match(/[A-Za-z0-9.,!?'"()\-\s]{4,}/g) || [];
      extractedText = words
        .map((w) => w.trim())
        .filter((w) => w.length > 3 && !w.startsWith('%PDF') && !w.startsWith('endobj') && !w.startsWith('xref'))
        .join(' ');
    }

    const metadata: Record<string, any> = {
      ...sourceMeta,
      fileName,
      mimeType: mimeType || 'application/pdf',
      charCount: extractedText.length,
    };

    return {
      title,
      content: extractedText,
      text: extractedText,
      metadata,
    };
  }
}
