import { TranscriptCue } from '@/core/models';
import { ParsingError } from '@/shared/errors';
import { TranscriptParser } from './TranscriptParser';
import { parseTimestampToSeconds } from './utils';

/**
 * Parser implementation for SubRip (.srt) transcript files.
 */
export class SrtTranscriptParser implements TranscriptParser {
  async parse(rawContent: string): Promise<TranscriptCue[]> {
    const cleanContent = rawContent.replace(/^\uFEFF/, '').trim();
    if (!cleanContent) {
      throw new ParsingError('Empty transcript: content is empty');
    }

    const lines = cleanContent.split(/\r?\n/);
    const cues: TranscriptCue[] = [];
    let order = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]?.trim() ?? '';

      if (!line) {
        i++;
        continue;
      }

      const numStr = line;
      if (!/^\d+$/.test(numStr)) {
        throw new ParsingError(
          `Corrupt transcript: invalid numbering in SRT file (expected sequence number ${order + 1}, found "${numStr}")`,
        );
      }

      const seqNum = parseInt(numStr, 10);
      const expectedOrder = order + 1;
      if (seqNum !== expectedOrder) {
        throw new ParsingError(
          `Corrupt transcript: invalid numbering in SRT file (expected sequence number ${expectedOrder}, found ${seqNum})`,
        );
      }

      i++;
      if (i >= lines.length || !lines[i]?.includes('-->')) {
        throw new ParsingError(
          `Corrupt transcript: missing timestamp line for SRT cue sequence number ${seqNum}`,
        );
      }

      const timestampLine = lines[i]?.trim() ?? '';
      const parts = timestampLine.split('-->');
      if (parts.length < 2) {
        throw new ParsingError(`Invalid timestamp format in SRT cue: "${timestampLine}"`);
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
      while (i < lines.length && lines[i]?.trim() !== '') {
        textLines.push(lines[i] as string);
        i++;
      }

      const text = textLines.join('\n').trim();
      if (!text) {
        throw new ParsingError(`Empty cue detection: cue ${seqNum} has empty text`);
      }

      order = seqNum;
      const duration = Number((endTime - startTime).toFixed(3));
      const cue: TranscriptCue = {
        id: String(seqNum),
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
