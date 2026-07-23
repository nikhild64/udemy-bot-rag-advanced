import { IExtractor } from './IExtractor';
import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument } from './IDocumentExtractor';
import { ExtractionError } from '@/shared/errors';
import AdmZip from 'adm-zip';

export class VttExtractor implements IExtractor {
  async extract(
    input: RawContent | Buffer | string,
    _mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument> {
    let rawContentStr = '';
    let title = fileName || 'Transcript';
    let sourceMeta: Record<string, any> = {};

    let bufferInput: Buffer | null = null;

    if (typeof input === 'object' && 'content' in input && 'sourceId' in input) {
      const raw = input as RawContent;
      if (Buffer.isBuffer(raw.content)) {
        bufferInput = raw.content;
      } else if (typeof raw.content === 'string') {
        rawContentStr = raw.content;
      }
      title = raw.metadata?.title || fileName || 'Transcript';
      sourceMeta = raw.metadata || {};
    } else if (Buffer.isBuffer(input)) {
      bufferInput = input;
    } else if (typeof input === 'string') {
      rawContentStr = input;
    } else {
      throw new ExtractionError('Invalid VTT extractor input: expected RawContent, Buffer, or string');
    }

    // Handle ZIP files
    if (bufferInput) {
      // Check for ZIP magic number (PK\x03\x04)
      if (bufferInput.length >= 4 && bufferInput[0] === 0x50 && bufferInput[1] === 0x4b) {
        try {
          const zip = new AdmZip(bufferInput);
          const zipEntries = zip.getEntries();
          const combinedVttContents: string[] = [];
          
          for (const entry of zipEntries) {
            if (!entry.isDirectory) {
              const entryExt = entry.entryName.split('.').pop()?.toLowerCase();
              if (entryExt === 'vtt' || entryExt === 'srt') {
                const text = entry.getData().toString('utf-8');
                combinedVttContents.push(text);
              }
            }
          }
          
          if (combinedVttContents.length === 0) {
            throw new ExtractionError('No VTT or SRT files found inside the ZIP archive');
          }
          
          rawContentStr = combinedVttContents.join('\n\n');
        } catch (err: any) {
          if (err instanceof ExtractionError) throw err;
          // Fallback if not a valid zip
          rawContentStr = bufferInput.toString('utf-8');
        }
      } else {
        rawContentStr = bufferInput.toString('utf-8');
      }
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
