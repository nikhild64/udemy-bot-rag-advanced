import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { TranscriptFormat } from '@/types';
import { ParsingError, NotFoundError } from '@/shared/errors';
import { TranscriptParserFactory } from '@/ingestion/parsing/TranscriptParserFactory';
import { TranscriptParsingService } from '@/ingestion/parsing/TranscriptParsingService';
import { IngestionOrchestrator } from '@/ingestion/orchestrator';
import { VttTranscriptParser } from '@/ingestion/parsing/parsers/VttTranscriptParser';
import { CourseManifest } from '@/ingestion/manifest';

describe('Transcript Parsing — General & Integration', () => {
  describe('TranscriptParserFactory', () => {
    it('should select VTT parser when format is VTT or file ends in .vtt', () => {
      const factory = new TranscriptParserFactory();
      expect(factory.getParser(TranscriptFormat.VTT)).toBeInstanceOf(VttTranscriptParser);
      expect(factory.getParser('lesson1.vtt')).toBeInstanceOf(VttTranscriptParser);
    });

    it('should select SRT parser when format is SRT or file ends in .srt', () => {
      const factory = new TranscriptParserFactory();
      expect(factory.getParser(TranscriptFormat.SRT)).toBeDefined();
      expect(factory.getParser('lesson1.srt')).toBeDefined();
    });

    it('should throw ParsingError for unsupported formats or extensions', () => {
      const factory = new TranscriptParserFactory();
      expect(() => factory.getParser('lesson1.xyz')).toThrowError(ParsingError);
      expect(() => factory.getParser('lesson1.xyz')).toThrowError('Unsupported transcript format');
    });

    it('should allow registering custom parser implementations', async () => {
      const factory = new TranscriptParserFactory();
      const mockCustomParser = {
        parse: vi.fn().mockResolvedValue([{ id: 'custom-1', startTime: 0, endTime: 1, text: 'Custom' }]),
      };
      factory.registerParser(TranscriptFormat.VTT, mockCustomParser);

      const parser = factory.getParser(TranscriptFormat.VTT);
      const res = await parser.parse('any');
      expect(res[0]?.text).toBe('Custom');
    });
  });

  describe('TranscriptParsingService - Missing Files and Corrupt Files Handling', () => {
    it('should throw NotFoundError when parseFile is invoked with a non-existent file path', async () => {
      const service = new TranscriptParsingService();
      const nonExistentPath = path.resolve('./data/extracted/non-existent-course/lesson1.vtt');

      await expect(
        service.parseFile('lesson-1', nonExistentPath, TranscriptFormat.VTT),
      ).rejects.toThrowError(NotFoundError);
    });

    it('should throw NotFoundError when parseManifest is invoked on a manifest whose files are completely missing on disk', async () => {
      const service = new TranscriptParsingService();
      const mockManifest: CourseManifest = {
        courseId: 'missing-course',
        courseName: 'Missing Course',
        rootDirectory: '/data/extracted/missing-course',
        version: '1.0.0',
        modulesCount: 1,
        lessonsCount: 1,
        transcriptsCount: 1,
        preferredTranscriptsCount: 1,
        modules: [
          {
            moduleId: 'mod-1',
            moduleName: 'Module 1',
            order: 1,
            lessons: [
              {
                lessonId: 'les-1',
                lessonName: 'Lesson 1',
                order: 1,
                transcripts: [
                  {
                    format: TranscriptFormat.VTT,
                    absolutePath: '/data/extracted/missing-course/les-1.vtt',
                    fileName: 'les-1.vtt',
                    preferred: true,
                  },
                ],
              },
            ],
          },
        ],
      };

      await expect(service.parseManifest(mockManifest)).rejects.toThrowError(NotFoundError);
    });
  });

  describe('IngestionOrchestrator.parse() Stage Integration', () => {
    it('should coordinate discovery, extraction, manifest building, and transcript parsing in execute()', async () => {
      const mockDiscoveryService = {
        discover: vi.fn().mockResolvedValue([
          {
            fileName: 'test-course.zip',
            absolutePath: '/input/test-course.zip',
            sizeBytes: 1024,
            format: 'zip' as const,
          },
        ]),
      };

      const mockExtractionService = {
        extract: vi.fn().mockResolvedValue({
          archiveName: 'test-course.zip',
          destinationPath: '/extracted/test-course',
          filesExtracted: ['lesson1.vtt'],
        }),
      };

      const mockManifestDiscoveryService = {
        discoverAll: vi.fn().mockResolvedValue([
          {
            courseId: 'test-course',
            courseName: 'Test Course',
            rootDirectory: '/extracted/test-course',
          },
        ]),
      };

      const mockCourseManifest: CourseManifest = {
        courseId: 'test-course',
        courseName: 'Test Course',
        rootDirectory: '/extracted/test-course',
        version: '1.0.0',
        modulesCount: 1,
        lessonsCount: 1,
        transcriptsCount: 1,
        preferredTranscriptsCount: 1,
        modules: [
          {
            moduleId: 'mod-1',
            moduleName: 'Module 1',
            order: 1,
            lessons: [
              {
                lessonId: 'les-1',
                lessonName: 'Lesson 1',
                order: 1,
                transcripts: [
                  {
                    format: TranscriptFormat.VTT,
                    absolutePath: '/extracted/test-course/lesson1.vtt',
                    fileName: 'lesson1.vtt',
                    preferred: true,
                  },
                ],
              },
            ],
          },
        ],
      };

      const mockManifestBuilder = {
        build: vi.fn().mockReturnValue(mockCourseManifest),
      };

      const mockManifestValidator = {
        validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      };

      const mockParsingService = {
        parseManifest: vi.fn().mockResolvedValue({
          courseId: 'test-course',
          courseName: 'Test Course',
          lessonsCount: 1,
          transcriptsParsedCount: 1,
          failedTranscriptsCount: 0,
          totalCuesCount: 15,
          durationMs: 50,
          success: true,
          transcripts: [
            {
              id: 'ts-les-1',
              lessonId: 'les-1',
              format: TranscriptFormat.VTT,
              cues: [],
            },
          ],
          lessonResults: [],
          errors: [],
        }),
        parseFile: vi.fn(),
      };

      const orchestrator = new IngestionOrchestrator(
        mockDiscoveryService,
        mockExtractionService,
        mockManifestDiscoveryService,
        mockManifestBuilder,
        mockManifestValidator,
        mockParsingService,
      );

      const result = await orchestrator.execute({
        inputDirectory: '/input',
        extractionDirectory: '/extracted',
      });

      expect(mockDiscoveryService.discover).toHaveBeenCalled();
      expect(mockExtractionService.extract).toHaveBeenCalled();
      expect(mockManifestBuilder.build).toHaveBeenCalled();
      expect(mockParsingService.parseManifest).toHaveBeenCalledWith(mockCourseManifest);

      expect(result.success).toBe(true);
      expect(result.totalTranscriptsParsed).toBe(1);
      expect(result.failedParsings).toBe(0);
      expect(result.totalCuesParsed).toBe(15);
      expect(result.parsingResults).toHaveLength(1);
    });
  });
});
