import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';

export class VttExtractor implements IExtractor {
  async extract(
    input: RawContent | Buffer | string,
    _mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument> {
    let rawContentStr: string;
    let title = fileName || 'Transcript';
    let sourceMeta: Record<string, any> = {};

    if (typeof input === 'object' && 'content' in input && 'sourceId' in input) {
      const raw = input as RawContent;
      rawContentStr = typeof raw.content === 'string' ? raw.content : raw.content.toString('utf-8');
      title = raw.metadata?.title || fileName || 'Transcript';
      sourceMeta = raw.metadata || {};
    } else if (Buffer.isBuffer(input)) {
      rawContentStr = input.toString('utf-8');
    } else if (typeof input === 'string') {
      rawContentStr = input;
    } else {
      throw new ExtractionError('Invalid VTT extractor input: expected RawContent, Buffer, or string');
    }

    const lines = rawContentStr.split(/\r?\n/);
    const textLines: string[] = [];
    const cues: Array<{ timestamp?: string; text: string }> = [];

    let currentTimestamp = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toUpperCase().startsWith('WEBVTT') || trimmed.toUpperCase().startsWith('NOTE')) {
        continue;
      }

      if (trimmed.includes('-->')) {
        currentTimestamp = trimmed;
        continue;
      }

      if (/^\d+$/.test(trimmed)) {
        continue;
      }

      const cleanText = trimmed.replace(/<[^>]*>/g, '').trim();
      if (cleanText) {
        textLines.push(cleanText);
        cues.push({
          ...(currentTimestamp ? { timestamp: currentTimestamp } : {}),
          text: cleanText,
        });
      }
    }

    const text = textLines.join(' ');
    const metadata: Record<string, any> = {
      ...sourceMeta,
      fileName,
      cueCount: cues.length,
      cues,
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
