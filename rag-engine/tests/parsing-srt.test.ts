import { describe, it, expect } from 'vitest';
import { SrtTranscriptParser } from '@/ingestion/parsing/parsers/SrtTranscriptParser';
import { ParsingError } from '@/shared/errors';

describe('SrtTranscriptParser', () => {
  const parser = new SrtTranscriptParser();

  it('should parse a standard SubRip (.srt) transcript accurately', async () => {
    const rawSrt = `1
00:00:01,000 --> 00:00:04,500
Hello and welcome to the SubRip parser test.

2
00:00:05,200 --> 00:00:09,800
Second cue entry with comma decimal separator.`;

    const cues = await parser.parse(rawSrt);
    expect(cues).toHaveLength(2);

    expect(cues[0]).toEqual({
      id: '1',
      startTime: 1,
      endTime: 4.5,
      duration: 3.5,
      text: 'Hello and welcome to the SubRip parser test.',
      order: 1,
    });

    expect(cues[1]).toEqual({
      id: '2',
      startTime: 5.2,
      endTime: 9.8,
      duration: 4.6,
      text: 'Second cue entry with comma decimal separator.',
      order: 2,
    });
  });

  it('should preserve multiline cue text entries accurately', async () => {
    const rawSrt = `1
00:01:00,000 --> 00:01:05,000
First line of SRT cue.
Second line of SRT cue.
Third line of SRT cue.`;

    const cues = await parser.parse(rawSrt);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.text).toBe(
      'First line of SRT cue.\nSecond line of SRT cue.\nThird line of SRT cue.',
    );
  });

  it('should throw ParsingError on an empty SRT transcript', async () => {
    await expect(parser.parse('')).rejects.toThrowError(ParsingError);
    await expect(parser.parse('   ')).rejects.toThrowError('Empty transcript');
  });

  it('should throw ParsingError on out-of-order or invalid numbering', async () => {
    const outOfOrderSrt = `1
00:00:01,000 --> 00:00:03,000
Valid cue 1.

3
00:00:04,000 --> 00:00:06,000
Skipped sequence number 2.`;

    await expect(parser.parse(outOfOrderSrt)).rejects.toThrowError('invalid numbering in SRT file (expected sequence number 2, found 3)');

    const nonNumericSrt = `abc
00:00:01,000 --> 00:00:03,000
Non-numeric index.`;
    await expect(parser.parse(nonNumericSrt)).rejects.toThrowError('invalid numbering in SRT file');
  });

  it('should throw ParsingError if timestamp line is missing or malformed', async () => {
    const missingTimestampSrt = `1
No timestamp here, just text directly after sequence number.`;

    await expect(parser.parse(missingTimestampSrt)).rejects.toThrowError('missing timestamp line for SRT cue sequence number 1');
  });
});
