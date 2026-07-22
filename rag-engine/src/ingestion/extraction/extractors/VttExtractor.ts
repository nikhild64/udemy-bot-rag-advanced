import { IDocumentExtractor, ExtractedDocument } from './IDocumentExtractor';

export class VttExtractor implements IDocumentExtractor {
  async extract(fileBuffer: Buffer, _mimeType?: string, fileName?: string): Promise<ExtractedDocument> {
    const rawContent = fileBuffer.toString('utf-8');
    const lines = rawContent.split(/\r?\n/);
    const textLines: string[] = [];
    const cues: Array<{ timestamp?: string; text: string }> = [];

    let currentTimestamp = '';

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip WEBVTT header and blank lines
      if (!trimmed || trimmed.toUpperCase().startsWith('WEBVTT') || trimmed.toUpperCase().startsWith('NOTE')) {
        continue;
      }

      // Check for timestamp line (e.g. 00:00:01.000 --> 00:00:04.000)
      if (trimmed.includes('-->')) {
        currentTimestamp = trimmed;
        continue;
      }

      // Cue identifier index numbers
      if (/^\d+$/.test(trimmed)) {
        continue;
      }

      // Strip VTT tags like <v Voice> or <b>
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
    return {
      text,
      metadata: {
        fileName,
        cueCount: cues.length,
        cues,
      },
    };
  }
}
