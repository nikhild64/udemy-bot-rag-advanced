import { TranscriptCue } from '@/core/models';
import { ParsingError } from '@/shared/errors';
import { TranscriptParser } from './TranscriptParser';
import { parseTimestampToSeconds } from './utils';

/**
 * Parser implementation for WebVTT (.vtt) transcript files.
 */
export class VttTranscriptParser implements TranscriptParser {
  async parse(rawContent: string): Promise<TranscriptCue[]> {
    const cleanContent = rawContent.replace(/^\uFEFF/, '').trim();
    if (!cleanContent) {
      throw new ParsingError('Empty transcript: content is empty');
    }

    const lines = cleanContent.split(/\r?\n/);
    const firstLine = lines[0]?.trim() ?? '';
    if (!firstLine.startsWith('WEBVTT')) {
      throw new ParsingError('Corrupt transcript: WebVTT file must start with WEBVTT header');
    }

    const cues: TranscriptCue[] = [];
    let order = 0;
    let i = 1;

    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';

      if (!line) {
        i++;
        continue;
      }

      if (line.startsWith('NOTE')) {
        while (i < lines.length && lines[i]?.trim() !== '') {
          i++;
        }
        continue;
      }

      let cueId: string | undefined;
      let timestampLine = line;

      if (!line.includes('-->')) {
        if (i + 1 < lines.length && lines[i + 1]?.includes('-->')) {
          cueId = line;
          i++;
          timestampLine = lines[i]?.trim() ?? '';
        } else {
          i++;
          continue;
        }
      }

      const parts = timestampLine.split('-->');
      if (parts.length < 2) {
        throw new ParsingError(`Invalid timestamp format in VTT cue: "${timestampLine}"`);
      }

      const startStr = parts[0]?.trim() ?? '';
      const endPart = parts[1]?.trim() ?? '';
      const endStr = endPart.split(/\s+/)[0] ?? '';

      const startTime = parseTimestampToSeconds(startStr);
      const endTime = parseTimestampToSeconds(endStr);

      if (startTime > endTime) {
        throw new ParsingError(
          `Invalid cue timing: start time (${startTime}) is greater than end time (${endTime})`,
        );
      }

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i]?.trim() !== '' && !lines[i]?.includes('-->')) {
        textLines.push(lines[i] as string);
        i++;
      }

      const text = textLines.join('\n').trim();
      if (!text) {
        throw new ParsingError(
          `Empty cue detection: cue with timestamp "${timestampLine}" has empty text`,
        );
      }

      order++;
      const duration = Number((endTime - startTime).toFixed(3));
      const cue: TranscriptCue = {
        id: cueId && cueId.trim() !== '' ? cueId.trim() : `cue-${order}`,
        startTime,
        endTime,
        duration,
        text,
        order,
      };

      cues.push(cue);
    }

    if (cues.length === 0) {
      throw new ParsingError('Empty transcript: no valid cues found in transcript');
    }

    return cues;
  }
}
