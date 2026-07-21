import { ParsingError } from '@/shared/errors';

/**
 * Parses a subtitle timestamp string (e.g. "00:01:23.456" or "01:23,456") into total seconds.
 * Supports both period (.) and comma (,) as decimal separators for WebVTT and SubRip formats.
 */
export function parseTimestampToSeconds(timestampStr: string): number {
  const trimmed = timestampStr.trim();
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(trimmed);
  if (!match) {
    throw new ParsingError(`Invalid timestamp format: "${timestampStr}"`);
  }
  const hours = match[1] !== undefined ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  let millis = 0;
  if (match[4] !== undefined) {
    const msStr = match[4].padEnd(3, '0').slice(0, 3);
    millis = parseInt(msStr, 10);
  }

  if (minutes >= 60 || seconds >= 60) {
    throw new ParsingError(
      `Invalid timestamp values in "${timestampStr}": minutes (${minutes}) and seconds (${seconds}) must be < 60`,
    );
  }

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}
