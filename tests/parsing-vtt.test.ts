import { describe, it, expect } from 'vitest';
import { VttTranscriptParser } from '@/ingestion/parsing/parsers/VttTranscriptParser';
import { ParsingError } from '@/shared/errors';

describe('VttTranscriptParser', () => {
  const parser = new VttTranscriptParser();

  it('should parse a standard WebVTT transcript with multiple cues accurately', async () => {
    const rawVtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.500
Welcome to the course on React and Next.js.

2
00:00:05.100 --> 00:00:09.250 align:middle
In this lesson, we will explore the core concepts.`;

    const cues = await parser.parse(rawVtt);
    expect(cues).toHaveLength(2);

    expect(cues[0]).toEqual({
      id: '1',
      startTime: 1,
      endTime: 4.5,
      duration: 3.5,
      text: 'Welcome to the course on React and Next.js.',
      order: 1,
    });

    expect(cues[1]).toEqual({
      id: '2',
      startTime: 5.1,
      endTime: 9.25,
      duration: 4.15,
      text: 'In this lesson, we will explore the core concepts.',
      order: 2,
    });
  });

  it('should preserve multiline entries within a single cue', async () => {
    const rawVtt = `WEBVTT

cue-intro
00:00:10.000 --> 00:00:15.000
Line 1: Setting up environment.
Line 2: Installing dependencies.
Line 3: Running local server.`;

    const cues = await parser.parse(rawVtt);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.text).toBe(
      'Line 1: Setting up environment.\nLine 2: Installing dependencies.\nLine 3: Running local server.',
    );
    expect(cues[0]?.id).toBe('cue-intro');
  });

  it('should skip NOTE blocks and header metadata cleanly', async () => {
    const rawVtt = `WEBVTT - Header Information
Kind: captions
Language: en

NOTE
This is a comment that should be skipped by the parser
Even if it spans multiple lines.

00:01:00.000 --> 00:01:05.000
Cue after note.`;

    const cues = await parser.parse(rawVtt);
    expect(cues).toHaveLength(1);
    expect(cues[0]?.text).toBe('Cue after note.');
    expect(cues[0]?.startTime).toBe(60);
  });

  it('should throw ParsingError on an empty transcript', async () => {
    await expect(parser.parse('')).rejects.toThrowError(ParsingError);
    await expect(parser.parse('   \n\n   ')).rejects.toThrowError('Empty transcript');
  });

  it('should throw ParsingError if WEBVTT header is missing', async () => {
    const invalidVtt = `00:00:01.000 --> 00:00:05.000\nNo header here.`;
    await expect(parser.parse(invalidVtt)).rejects.toThrowError('WEBVTT header');
  });

  it('should throw ParsingError on invalid timestamp format or timing values', async () => {
    const badTimestamp = `WEBVTT\n\n00:00:05.000 --> 00:00:02.000\nStart greater than end.`;
    await expect(parser.parse(badTimestamp)).rejects.toThrowError('start time (5) is greater than end time (2)');

    const badFormat = `WEBVTT\n\n99:99:99 --> 00:00:05.000\nInvalid seconds and minutes.`;
    await expect(parser.parse(badFormat)).rejects.toThrowError('minutes (99) and seconds (99) must be < 60');
  });

  it('should throw ParsingError when a cue has empty text', async () => {
    const emptyCueText = `WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n\n00:00:04.000 --> 00:00:06.000\nNext cue.`;
    await expect(parser.parse(emptyCueText)).rejects.toThrowError('Empty cue detection');
  });

  it('should handle large transcripts (1,000+ cues) accurately and efficiently', async () => {
    let rawLargeVtt = 'WEBVTT\n\n';
    const totalCues = 1500;
    for (let i = 1; i <= totalCues; i++) {
      const startSec = (i - 1) * 2;
      const endSec = startSec + 1;
      rawLargeVtt += `${i}\n00:00:${String(startSec % 60).padStart(2, '0')}.000 --> 00:00:${String(endSec % 60).padStart(2, '0')}.500\nCue text for index ${i}\n\n`;
    }

    const startTime = Date.now();
    const cues = await parser.parse(rawLargeVtt);
    const duration = Date.now() - startTime;

    expect(cues).toHaveLength(totalCues);
    expect(cues[0]?.text).toBe('Cue text for index 1');
    expect(cues[totalCues - 1]?.text).toBe(`Cue text for index ${totalCues}`);
    expect(duration).toBeLessThan(1000); // verify linear O(n) performance
  });
});
