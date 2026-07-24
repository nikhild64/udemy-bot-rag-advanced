import zlib from 'node:zlib';
import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';
import { logger } from '@/shared/logger';

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

    let extractedText = '';
    let pdfMetadata: Record<string, any> = {};

    // 1. Primary Extraction using pdf-parse library
    try {
      if (fileBuffer && fileBuffer.length > 0) {
        const pdfParseModule = await import('pdf-parse');
        const rawFn: any = (pdfParseModule as any).default || pdfParseModule;
        const pdfParse = typeof rawFn === 'function' ? rawFn : rawFn.default;
        if (typeof pdfParse === 'function') {
          const parsed = await pdfParse(fileBuffer);
          if (parsed && typeof parsed.text === 'string' && parsed.text.trim().length > 0) {
            extractedText = parsed.text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
          }
          if (parsed && parsed.info) {
            pdfMetadata.info = parsed.info;
          }
          if (parsed && parsed.numpages) {
            pdfMetadata.numPages = parsed.numpages;
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || String(err), fileName }, 'pdf-parse library extraction failed, trying stream fallback');
    }

    // 2. Fallback text extraction from PDF streams (including FlateDecode zlib streams)
    if (!extractedText || extractedText.trim().length < 5) {
      extractedText = this.extractFromPdfStreams(fileBuffer);
    }

    // 3. Guaranteed non-empty placeholder fallback for scanned or image-only PDFs
    if (!extractedText || extractedText.trim().length < 5) {
      logger.warn({ fileName, title }, 'PDF contains no extractable text layer, using structured document placeholder');
      extractedText = `Document: ${title}\nFile: ${fileName || title}\nStatus: This PDF document does not contain an embedded text layer (e.g. scanned image file or graphic presentation).`;
    }

    const metadata: Record<string, any> = {
      ...sourceMeta,
      ...pdfMetadata,
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

  /**
   * Scans PDF streams (including FlateDecode zlib streams) for text operators.
   */
  private extractFromPdfStreams(buffer: Buffer): string {
    const textPieces: string[] = [];
    const contentStr = buffer.toString('utf-8');

    // A. Direct uncompressed Tj / TJ scan
    this.scanTjOperators(contentStr, textPieces);

    if (textPieces.length > 0) {
      return textPieces.join(' ').trim();
    }

    // B. Decompress stream ... endstream blocks using zlib.unzipSync
    try {
      const streamStartRegex = /stream\r?\n/g;
      let startMatch: RegExpExecArray | null;
      while ((startMatch = streamStartRegex.exec(contentStr)) !== null) {
        const streamStart = startMatch.index + startMatch[0].length;
        const streamEnd = contentStr.indexOf('endstream', streamStart);
        if (streamEnd > streamStart) {
          const rawStreamBytes = buffer.subarray(streamStart, streamEnd);
          try {
            const decompressed = zlib.unzipSync(rawStreamBytes);
            const decompressedStr = decompressed.toString('utf-8');
            this.scanTjOperators(decompressedStr, textPieces);
          } catch {
            // Ignore non-zlib streams
          }
        }
      }
    } catch {
      // Ignore stream scan errors
    }

    const streamResult = textPieces.join(' ').trim();
    if (streamResult.length > 0) {
      return streamResult;
    }

    // C. Clean word extraction without PDF structure keywords or object reference syntax
    const binaryStr = buffer.toString('latin1');
    const cleanAscii = binaryStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    const rawWords = cleanAscii.match(/[A-Za-z0-9.,!?'"()\-\s]{4,}/g) || [];

    const filteredWords = rawWords
      .map((w) => w.trim())
      .filter((w) => {
        if (w.length < 4) return false;
        if (/^(%PDF|endobj|xref|trailer|startxref|Catalog|Pages|MediaBox|Font|Encoding|FlateDecode)/i.test(w)) return false;
        if (/^\d+\s+\d+\s+(R|obj)$/i.test(w)) return false;
        if (/^ent\s+\d+\s+0\s+R/i.test(w)) return false;
        return true;
      });

    return filteredWords.join(' ').trim();
  }

  private scanTjOperators(str: string, targetArray: string[]): void {
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(str)) !== null) {
      if (match[1] && match[1].trim()) {
        targetArray.push(match[1].trim());
      }
    }

    const arrayTjRegex = /\[((?:[^\]]+))\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(str)) !== null) {
      if (match[1]) {
        const innerPieces = match[1].match(/\(([^)]+)\)/g);
        if (innerPieces) {
          innerPieces.forEach((p) => {
            const cleaned = p.replace(/^\(|\)$/g, '').trim();
            if (cleaned) targetArray.push(cleaned);
          });
        }
      }
    }
  }
}
