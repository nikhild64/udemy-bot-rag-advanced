import zlib from 'node:zlib';
import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export class PdfExtractor implements IExtractor {
  async extract(input: RawContent | Buffer | string, mimeType?: string, fileName?: string): Promise<NormalizedDocument & ExtractedDocument> {
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
    const pdfMetadata: Record<string, any> = {};

    // pdf-parse v2 exposes PDFParse({ data }).getText(); v1 compatibility is retained.
    try {
      if (fileBuffer.length > 0) {
        const pdfParseModule: any = await import('pdf-parse');
        if (typeof pdfParseModule.PDFParse === 'function') {
          const parser = new pdfParseModule.PDFParse({ data: fileBuffer });
          try {
            const parsed = await parser.getText();
            if (parsed?.text && this.isUsablePdfText(parsed.text)) extractedText = this.normalizeText(parsed.text);
            if (Array.isArray(parsed?.pages) && parsed.pages.length > 0) {
              pdfMetadata.pageTexts = parsed.pages.map((page: { num?: number; text?: string }, index: number) => ({
                page: page.num || index + 1,
                text: this.normalizeText(page.text || ''),
              })).filter((page: { text: string }) => page.text.length > 0);
            }
            const info = await parser.getInfo();
            if (info?.info) pdfMetadata.info = info.info;
            if (info?.total) pdfMetadata.numPages = info.total;
          } finally {
            await parser.destroy();
          }
        } else {
          const legacyParser = pdfParseModule.default || pdfParseModule;
          if (typeof legacyParser === 'function') {
            const parsed = await legacyParser(fileBuffer);
            if (parsed?.text && this.isUsablePdfText(parsed.text)) extractedText = this.normalizeText(parsed.text);
            if (Array.isArray(parsed?.pages) && parsed.pages.length > 0) {
              pdfMetadata.pageTexts = parsed.pages.map((page: { num?: number; text?: string }, index: number) => ({
                page: page.num || index + 1,
                text: this.normalizeText(page.text || ''),
              })).filter((page: { text: string }) => page.text.length > 0);
            }
            if (parsed?.info) pdfMetadata.info = parsed.info;
            if (parsed?.numpages) pdfMetadata.numPages = parsed.numpages;
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || String(err), fileName }, 'PDF library extraction failed, trying stream fallback');
    }

    if (!extractedText || extractedText.length < 5) extractedText = this.extractFromPdfStreams(fileBuffer);
    if (!extractedText || extractedText.length < 5) {
      logger.warn({ fileName, title }, 'PDF contains no extractable text layer');
      extractedText = `Document: ${title}\nFile: ${fileName || title}\nStatus: This PDF document does not contain an embedded text layer (e.g. scanned image file or graphic presentation).`;
    }

    return {
      title,
      content: extractedText,
      text: extractedText,
      metadata: { ...sourceMeta, ...pdfMetadata, fileName, mimeType: mimeType || 'application/pdf', charCount: extractedText.length },
    };
  }

  private extractFromPdfStreams(buffer: Buffer): string {
    const pieces: string[] = [];
    // Keep support for extractor unit fixtures and non-standard PDF-like input.
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'))) {
      this.scanTjOperators(buffer.toString('latin1'), pieces);
      return this.normalizeText(pieces.join(' '));
    }
    const streamMarker = Buffer.from('stream', 'ascii');
    const endMarker = Buffer.from('endstream', 'ascii');
    let cursor = 0;

    while ((cursor = buffer.indexOf(streamMarker, cursor)) !== -1) {
      const before = cursor === 0 ? 0x0a : (buffer[cursor - 1] ?? -1);
      const after = buffer[cursor + streamMarker.length] ?? -1;
      cursor += streamMarker.length;
      if (!([0x0a, 0x0d, 0x20].includes(before)) || !([0x0a, 0x0d, 0x20].includes(after))) continue;

      let start = cursor;
      if (buffer[start] === 0x0d) start++;
      if (buffer[start] === 0x0a) start++;
      const end = buffer.indexOf(endMarker, start);
      if (end === -1) continue;
      const raw = buffer.subarray(start, end);
      this.scanTjOperators(raw.toString('latin1'), pieces);
      const inflated = this.inflatePdfStream(raw);
      if (inflated) this.scanTjOperators(inflated.toString('latin1'), pieces);
      cursor = end + endMarker.length;
    }

    return this.normalizeText(pieces.join(' '));
  }

  private inflatePdfStream(stream: Buffer): Buffer | null {
    for (const inflate of [zlib.inflateSync, zlib.inflateRawSync, zlib.unzipSync]) {
      try { return inflate(stream); } catch { /* Try the next stream encoding. */ }
    }
    return null;
  }

  private scanTjOperators(str: string, target: string[]): void {
    const literal = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = literal.exec(str))) {
      const value = (match[1] ?? '').replace(/\\([\\()])/g, '$1').trim();
      if (value) target.push(value);
    }

    const arrays = /\[((?:[^\]]+))\]\s*TJ/g;
    while ((match = arrays.exec(str))) {
      for (const part of (match[1] ?? '').matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
        const value = (part[1] ?? '').replace(/\\([\\()])/g, '$1').trim();
        if (value) target.push(value);
      }
    }
  }

  private normalizeText(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  private isUsablePdfText(text: string): boolean {
    const normalized = this.normalizeText(text);
    return normalized.length >= 5 && !/\bendstream\b|\bendobj\b|\bstartxref\b|%PDF-/i.test(normalized);
  }
}
