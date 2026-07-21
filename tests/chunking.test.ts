import { describe, it, expect, beforeEach } from 'vitest';
import {
  Chunk,
  Transcript,
  TranscriptCue,
} from '../src/core/models';
import { TranscriptFormat } from '../src/types';
import {
  ChunkingService,
  ChunkValidator,
  SemanticChunkingStrategy,
  ChunkingError,
} from '../src/ingestion/chunking';
import { ParsingResult, LessonParsingResult } from '../src/ingestion/parsing';
import { IngestionOrchestrator } from '../src/ingestion/orchestrator';

describe('Phase 7 — Semantic Chunking Module', () => {
  describe('SemanticChunkingStrategy', () => {
    let strategy: SemanticChunkingStrategy;

    beforeEach(() => {
      strategy = new SemanticChunkingStrategy();
    });

    it('Single transcript: should generate chunks adhering to max characters limit', () => {
      const cues: TranscriptCue[] = [
        { id: '1', startTime: 0, endTime: 2, text: 'Hello world, this is our first sentence.' },
        { id: '2', startTime: 2, endTime: 4, text: 'We are learning how semantic chunking works.' },
        { id: '3', startTime: 4, endTime: 6, text: 'It groups cues together until max size is reached.' },
      ];
      const transcript: Transcript = {
        id: 'ts-1',
        lessonId: 'lesson-1',
        format: TranscriptFormat.VTT,
        cues,
      };

      const chunks = strategy.chunk(transcript, {
        courseId: 'course-1',
        moduleId: 'mod-1',
        lessonId: 'lesson-1',
        transcriptId: 'ts-1',
        config: { maxCharacters: 100, overlapCharacters: 20, minCharacters: 10 },
      });

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.text.length).toBeLessThanOrEqual(100);
        expect(chunk.courseId).toBe('course-1');
        expect(chunk.moduleId).toBe('mod-1');
        expect(chunk.lessonId).toBe('lesson-1');
      }
    });

    it('Large transcript: should split across multiple chunks with configured overlap', () => {
      const cues: TranscriptCue[] = [];
      for (let i = 0; i < 50; i++) {
        cues.push({
          id: `cue-${i}`,
          startTime: i * 2,
          endTime: i * 2 + 2,
          text: `This is cue number ${i} in our long transcript text segment.`,
        });
      }
      const transcript: Transcript = {
        id: 'ts-large',
        lessonId: 'lesson-large',
        format: TranscriptFormat.VTT,
        cues,
      };

      const chunks = strategy.chunk(transcript, {
        courseId: 'course-large',
        moduleId: 'mod-large',
        lessonId: 'lesson-large',
        transcriptId: 'ts-large',
        config: { maxCharacters: 200, overlapCharacters: 50, minCharacters: 30 },
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Verify overlap exists between consecutive chunks
      for (let i = 1; i < chunks.length; i++) {
        const prevEndCueId = chunks[i - 1].metadata.originalCueRange?.endCueId;
        const currentStartCueId = chunks[i].metadata.originalCueRange?.startCueId;
        expect(prevEndCueId).toBeDefined();
        expect(currentStartCueId).toBeDefined();
      }
    });

    it('Small transcript: should generate single chunk when total text fits within limits', () => {
      const cues: TranscriptCue[] = [
        { id: '1', startTime: 0, endTime: 3, text: 'Short lesson intro.' },
      ];
      const transcript: Transcript = {
        id: 'ts-short',
        lessonId: 'lesson-short',
        format: TranscriptFormat.VTT,
        cues,
      };

      const chunks = strategy.chunk(transcript, {
        courseId: 'course-short',
        moduleId: 'mod-short',
        lessonId: 'lesson-short',
        transcriptId: 'ts-short',
        config: { maxCharacters: 500, overlapCharacters: 50, minCharacters: 10 },
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe('Short lesson intro.');
      expect(chunks[0].cueCount).toBe(1);
    });

    it('Empty transcript: should throw ChunkingError when cues array is empty or missing', () => {
      const transcript: Transcript = {
        id: 'ts-empty',
        lessonId: 'lesson-empty',
        format: TranscriptFormat.VTT,
        cues: [],
      };

      expect(() =>
        strategy.chunk(transcript, {
          courseId: 'course-1',
          moduleId: 'mod-1',
          lessonId: 'lesson-empty',
          transcriptId: 'ts-empty',
        }),
      ).toThrow(ChunkingError);
    });

    it('Zero overlap: should generate distinct consecutive chunks without overlap when overlapCharacters is 0', () => {
      const cues: TranscriptCue[] = [
        { id: 'cue-1', startTime: 0, endTime: 2, text: 'First segment of the lesson.' },
        { id: 'cue-2', startTime: 2, endTime: 4, text: 'Second segment of the lesson.' },
        { id: 'cue-3', startTime: 4, endTime: 6, text: 'Third segment of the lesson.' },
      ];
      const transcript: Transcript = {
        id: 'ts-zero',
        lessonId: 'lesson-zero',
        format: TranscriptFormat.VTT,
        cues,
      };

      const chunks = strategy.chunk(transcript, {
        courseId: 'course-1',
        moduleId: 'mod-1',
        lessonId: 'lesson-zero',
        transcriptId: 'ts-zero',
        config: { maxCharacters: 35, overlapCharacters: 0, minCharacters: 10 },
      });

      expect(chunks.length).toBeGreaterThan(1);
      // With zero overlap, every cue should belong to exactly one chunk or no duplicated text across boundaries
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('First segment of the lesson.');
      expect(allText).toContain('Second segment of the lesson.');
      expect(allText).toContain('Third segment of the lesson.');
    });

    it('Configured overlap: should throw error if overlapCharacters >= maxCharacters', () => {
      const transcript: Transcript = {
        id: 'ts-1',
        lessonId: 'l-1',
        format: TranscriptFormat.VTT,
        cues: [{ id: '1', startTime: 0, endTime: 1, text: 'Hi' }],
      };

      expect(() =>
        strategy.chunk(transcript, {
          courseId: 'c-1',
          moduleId: 'm-1',
          lessonId: 'l-1',
          transcriptId: 'ts-1',
          config: { maxCharacters: 100, overlapCharacters: 100 },
        }),
      ).toThrow(ChunkingError);
    });

    it('Boundary conditions & Correct timestamps: chunks must capture accurate start/end times and durations', () => {
      const cues: TranscriptCue[] = [
        { id: 'c1', startTime: 1.5, endTime: 4.2, text: 'Welcome to this module.' },
        { id: 'c2', startTime: 4.2, endTime: 8.9, text: 'We will study deep learning.' },
      ];
      const transcript: Transcript = {
        id: 'ts-ts',
        lessonId: 'l-ts',
        format: TranscriptFormat.VTT,
        cues,
      };

      const chunks = strategy.chunk(transcript, {
        courseId: 'c-1',
        moduleId: 'm-1',
        lessonId: 'l-ts',
        transcriptId: 'ts-ts',
        config: { maxCharacters: 500, overlapCharacters: 0 },
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].startTime).toBe(1.5);
      expect(chunks[0].endTime).toBe(8.9);
      expect(chunks[0].duration).toBeCloseTo(7.4, 2);
    });

    it('Correct lesson mapping, Correct module mapping, Correct cue ranges: verify complete metadata fields', () => {
      const cues: TranscriptCue[] = [
        { id: 'cue-100', order: 0, startTime: 10, endTime: 15, text: 'Lesson part one.' },
        { id: 'cue-101', order: 1, startTime: 15, endTime: 20, text: 'Lesson part two.' },
      ];
      const transcript: Transcript = {
        id: 'ts-meta',
        lessonId: 'lesson-meta-99',
        format: TranscriptFormat.VTT,
        cues,
        sourceFile: '/path/to/transcript.vtt',
      };

      const chunks = strategy.chunk(transcript, {
        courseId: 'course-meta-1',
        moduleId: 'module-meta-2',
        lessonId: 'lesson-meta-99',
        transcriptId: 'ts-meta',
      });

      expect(chunks).toHaveLength(1);
      const meta = chunks[0].metadata;
      expect(meta.courseId).toBe('course-meta-1');
      expect(meta.moduleId).toBe('module-meta-2');
      expect(meta.lessonId).toBe('lesson-meta-99');
      expect(meta.transcriptId).toBe('ts-meta');
      expect(meta.sourceTranscriptPath).toBe('/path/to/transcript.vtt');
      expect(meta.originalCueRange).toEqual({
        startCueId: 'cue-100',
        endCueId: 'cue-101',
        startOrder: 0,
        endOrder: 1,
      });
    });
  });

  describe('ChunkValidator', () => {
    let validator: ChunkValidator;

    beforeEach(() => {
      validator = new ChunkValidator();
    });

    it('Empty chunk: should fail validation if any chunk has empty text', () => {
      const chunks: Chunk[] = [
        {
          id: 'chunk-1',
          text: 'Valid text here.',
          metadata: { courseId: 'c1', moduleId: 'm1', lessonId: 'l1', transcriptId: 't1' },
        },
        {
          id: 'chunk-2',
          text: '   ',
          metadata: { courseId: 'c1', moduleId: 'm1', lessonId: 'l1', transcriptId: 't1' },
        },
      ];

      const res = validator.validate(chunks);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('contains no text content'))).toBe(true);
    });

    it('Invalid timestamps: should fail validation if timestamps are negative or startTime > endTime', () => {
      const chunks: Chunk[] = [
        {
          id: 'chunk-bad-ts',
          text: 'Timestamp issue.',
          startTime: 10,
          endTime: 5,
          metadata: {
            courseId: 'c1',
            moduleId: 'm1',
            lessonId: 'l1',
            transcriptId: 't1',
            startTime: 10,
            endTime: 5,
          },
        },
      ];

      const res = validator.validate(chunks);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('startTime (10) > endTime (5)'))).toBe(true);
    });

    it('Duplicate chunk IDs: should fail validation if two chunks share the exact same id', () => {
      const chunks: Chunk[] = [
        {
          id: 'ts-1-chk-0',
          text: 'First part of chunk.',
          metadata: { courseId: 'c1', moduleId: 'm1', lessonId: 'l1', transcriptId: 't1' },
        },
        {
          id: 'ts-1-chk-0',
          text: 'Second part of chunk.',
          metadata: { courseId: 'c1', moduleId: 'm1', lessonId: 'l1', transcriptId: 't1' },
        },
      ];

      const res = validator.validate(chunks);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Duplicate chunk ID detected: "ts-1-chk-0"'))).toBe(
        true,
      );
    });
  });

  describe('ChunkingService & Multiple lessons / ParsingResult integration', () => {
    let service: ChunkingService;

    beforeEach(() => {
      service = new ChunkingService();
    });

    it('Multiple lessons: should chunk all transcripts across a ParsingResult accurately', async () => {
      const lessonResults: LessonParsingResult[] = [
        {
          lessonId: 'l-1',
          lessonName: 'Lesson 1',
          transcriptPath: '/t1.vtt',
          format: 'vtt',
          cuesCount: 2,
          success: true,
          courseId: 'c-mult',
          moduleId: 'm-mult',
          transcript: {
            id: 'ts-l-1',
            lessonId: 'l-1',
            format: TranscriptFormat.VTT,
            cues: [
              { id: '1', startTime: 0, endTime: 5, text: 'Lesson one intro.' },
              { id: '2', startTime: 5, endTime: 10, text: 'Lesson one details.' },
            ],
          },
        },
        {
          lessonId: 'l-2',
          lessonName: 'Lesson 2',
          transcriptPath: '/t2.vtt',
          format: 'vtt',
          cuesCount: 2,
          success: true,
          courseId: 'c-mult',
          moduleId: 'm-mult',
          transcript: {
            id: 'ts-l-2',
            lessonId: 'l-2',
            format: TranscriptFormat.VTT,
            cues: [
              { id: '3', startTime: 0, endTime: 4, text: 'Lesson two start.' },
              { id: '4', startTime: 4, endTime: 8, text: 'Lesson two wrap up.' },
            ],
          },
        },
      ];

      const parsingResult: ParsingResult = {
        courseId: 'c-mult',
        courseName: 'Multiple Lessons Course',
        lessonsCount: 2,
        transcriptsParsedCount: 2,
        failedTranscriptsCount: 0,
        totalCuesCount: 4,
        durationMs: 15,
        success: true,
        transcripts: lessonResults.map((l) => l.transcript!),
        lessonResults,
        errors: [],
      };

      const result = await service.chunkParsingResult(parsingResult);

      expect(result.success).toBe(true);
      expect(result.transcriptsChunkedCount).toBe(2);
      expect(result.failedTranscriptsCount).toBe(0);
      expect(result.totalChunksCount).toBeGreaterThanOrEqual(2);
      expect(result.transcriptResults).toHaveLength(2);
      expect(result.chunks.every((c) => c.courseId === 'c-mult' && c.moduleId === 'm-mult')).toBe(
        true,
      );
    });

    it('should handle and record individual transcript errors without crashing the service', async () => {
      const lessonResults: LessonParsingResult[] = [
        {
          lessonId: 'l-err',
          lessonName: 'Lesson Error',
          transcriptPath: '/err.vtt',
          format: 'vtt',
          cuesCount: 0,
          success: true,
          transcript: {
            id: 'ts-err',
            lessonId: 'l-err',
            format: TranscriptFormat.VTT,
            cues: [], // Empty cues will cause strategy to throw
          },
        },
      ];

      const parsingResult: ParsingResult = {
        courseId: 'c-err',
        courseName: 'Error Course',
        lessonsCount: 1,
        transcriptsParsedCount: 1,
        failedTranscriptsCount: 0,
        totalCuesCount: 0,
        durationMs: 5,
        success: true,
        transcripts: [],
        lessonResults,
        errors: [],
      };

      const result = await service.chunkParsingResult(parsingResult);

      expect(result.success).toBe(false);
      expect(result.failedTranscriptsCount).toBe(1);
      expect(result.transcriptsChunkedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.transcriptResults[0].success).toBe(false);
    });
  });

  describe('IngestionOrchestrator chunk() & execute() integration', () => {
    it('should run chunk() directly on a ParsingResult array', async () => {
      const orchestrator = new IngestionOrchestrator();
      const mockParsingResult: ParsingResult = {
        courseId: 'c-orch',
        courseName: 'Orchestrator Course',
        lessonsCount: 1,
        transcriptsParsedCount: 1,
        failedTranscriptsCount: 0,
        totalCuesCount: 1,
        durationMs: 10,
        success: true,
        transcripts: [],
        lessonResults: [
          {
            lessonId: 'l-o',
            lessonName: 'Lesson Orch',
            transcriptPath: '/o.vtt',
            format: 'vtt',
            cuesCount: 1,
            success: true,
            courseId: 'c-orch',
            moduleId: 'm-orch',
            transcript: {
              id: 'ts-o',
              lessonId: 'l-o',
              format: TranscriptFormat.VTT,
              cues: [{ id: 'cue-o', startTime: 0, endTime: 1, text: 'Orchestrator chunking test.' }],
            },
          },
        ],
        errors: [],
      };

      const chunkResults = await orchestrator.chunk([mockParsingResult]);
      expect(chunkResults).toHaveLength(1);
      expect(chunkResults[0].success).toBe(true);
      expect(chunkResults[0].totalChunksCount).toBe(1);
      expect(chunkResults[0].chunks[0].text).toBe('Orchestrator chunking test.');
    });
  });
});
