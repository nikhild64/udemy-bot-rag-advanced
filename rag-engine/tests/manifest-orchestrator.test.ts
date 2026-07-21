import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IngestionOrchestrator,
  IngestionResult,
} from '../src/ingestion/orchestrator';
import {
  ICourseManifestDiscoveryService,
  ICourseManifestBuilder,
  IManifestValidator,
  CourseManifest,
  DiscoveredCourse,
} from '../src/ingestion/manifest';
import { IInputDiscoveryService } from '../src/ingestion/discovery';
import { IExtractionService } from '../src/ingestion/extraction';
import { TranscriptFormat } from '../src/types';
import { runManifest } from '../src/cli/manifest';

describe('Manifest Orchestrator & CLI Integration', () => {
  let mockDiscoveryService: IInputDiscoveryService;
  let mockExtractionService: IExtractionService;
  let mockManifestDiscoveryService: ICourseManifestDiscoveryService;
  let mockManifestBuilder: ICourseManifestBuilder;
  let mockManifestValidator: IManifestValidator;
  let orchestrator: IngestionOrchestrator;

  const mockCourseManifest: CourseManifest = {
    courseId: 'angular-course',
    courseName: 'Angular Masterclass',
    rootDirectory: '/extracted/angular-course',
    modules: [
      {
        moduleId: '01',
        moduleName: 'Introduction',
        modulePath: '01 Introduction',
        lessons: [
          {
            lessonId: '001',
            lessonName: 'Welcome',
            lessonPath: '01 Introduction/001 Welcome',
            transcripts: [
              {
                fileName: '001 Welcome.vtt',
                absolutePath: '/extracted/angular-course/01 Introduction/001 Welcome/001 Welcome.vtt',
                relativePath: '01 Introduction/001 Welcome/001 Welcome.vtt',
                format: TranscriptFormat.VTT,
                preferred: true,
                fileSize: 100,
              },
              {
                fileName: '001 Welcome.srt',
                absolutePath: '/extracted/angular-course/01 Introduction/001 Welcome/001 Welcome.srt',
                relativePath: '01 Introduction/001 Welcome/001 Welcome.srt',
                format: TranscriptFormat.SRT,
                preferred: false,
                fileSize: 90,
              },
            ],
          },
        ],
      },
    ],
  };

  const mockDiscoveredCourse: DiscoveredCourse = {
    directoryName: 'angular-course',
    rootDirectory: '/extracted/angular-course',
    modules: [],
  };

  beforeEach(() => {
    mockDiscoveryService = {
      discover: vi.fn().mockResolvedValue([
        {
          name: 'angular-course.zip',
          path: '/input/angular-course.zip',
          extension: '.zip',
          size: 1024,
          modifiedAt: new Date(),
        },
      ]),
    };

    mockExtractionService = {
      extract: vi.fn().mockResolvedValue({
        archiveName: 'angular-course.zip',
        destinationPath: '/extracted/angular-course',
        filesExtracted: ['001 Welcome.vtt'],
        durationMs: 10,
        success: true,
      }),
      extractAll: vi.fn(),
    };

    mockManifestDiscoveryService = {
      discover: vi.fn().mockResolvedValue(mockDiscoveredCourse),
      discoverAll: vi.fn().mockResolvedValue([mockDiscoveredCourse]),
    };

    mockManifestBuilder = {
      build: vi.fn().mockReturnValue(mockCourseManifest),
    };

    mockManifestValidator = {
      validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
      assertValid: vi.fn(),
    };

    orchestrator = new IngestionOrchestrator(
      mockDiscoveryService,
      mockExtractionService,
      mockManifestDiscoveryService,
      mockManifestBuilder,
      mockManifestValidator,
    );
  });

  describe('orchestrator.manifest()', () => {
    it('should run discovery, builder, and validator across extracted courses and return ManifestResult[]', async () => {
      const results = await orchestrator.manifest({ extractionDirectory: '/extracted' });

      expect(mockManifestDiscoveryService.discoverAll).toHaveBeenCalledWith('/extracted');
      expect(mockManifestBuilder.build).toHaveBeenCalledWith(mockDiscoveredCourse);
      expect(mockManifestValidator.validate).toHaveBeenCalledWith(mockCourseManifest);

      expect(results).toHaveLength(1);
      const res = results[0];
      expect(res.courseId).toBe('angular-course');
      expect(res.courseName).toBe('Angular Masterclass');
      expect(res.modulesCount).toBe(1);
      expect(res.lessonsCount).toBe(1);
      expect(res.transcriptsCount).toBe(2);
      expect(res.preferredTranscriptsCount).toBe(1);
      expect(res.secondaryTranscriptsCount).toBe(1);
      expect(res.success).toBe(true);
      expect(res.manifest).toBe(mockCourseManifest);
    });

    it('should mark success false if manifest validation returns errors', async () => {
      mockManifestValidator.validate = vi
        .fn()
        .mockReturnValue({ valid: false, errors: ['Duplicate lesson ID'] });

      const results = await orchestrator.manifest();
      expect(results[0].success).toBe(false);
      expect(results[0].validationErrors).toEqual(['Duplicate lesson ID']);
    });
  });

  describe('orchestrator.execute() extension', () => {
    it('should coordinate Discover -> Extract -> Generate Course Manifest and return extended IngestionResult', async () => {
      const result: IngestionResult = await orchestrator.execute({
        inputDirectory: '/input',
        extractionDirectory: '/extracted',
      });

      expect(mockDiscoveryService.discover).toHaveBeenCalledWith('/input');
      expect(mockExtractionService.extract).toHaveBeenCalledTimes(1);
      expect(mockManifestDiscoveryService.discoverAll).toHaveBeenCalledWith('/extracted');

      expect(result.totalArchivesDiscovered).toBe(1);
      expect(result.totalArchivesExtracted).toBe(1);
      expect(result.successfulExtractions).toBe(1);
      expect(result.failedExtractions).toBe(0);
      expect(result.totalManifestsGenerated).toBe(1);
      expect(result.failedManifests).toBe(0);
      expect(result.manifests).toHaveLength(1);
      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should set overall workflow success to false and record failure when manifest validation fails during execute()', async () => {
      mockManifestValidator.validate = vi
        .fn()
        .mockReturnValue({ valid: false, errors: ['Empty module found'] });

      const result: IngestionResult = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(result.failedManifests).toBe(1);
      expect(result.failures).toEqual([
        {
          archiveName: 'Angular Masterclass',
          error: 'Manifest validation failed: Empty module found',
        },
      ]);
    });
  });

  describe('runManifest() CLI entry point', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    });

    it('should invoke orchestrator.manifest() and output exact summary format', async () => {
      await runManifest(orchestrator);

      expect(mockManifestDiscoveryService.discoverAll).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Generating course manifests...\n');
      expect(logSpy).toHaveBeenCalledWith('Course');
      expect(logSpy).toHaveBeenCalledWith('Angular Masterclass');
      expect(logSpy).toHaveBeenCalledWith('Modules');
      expect(logSpy).toHaveBeenCalledWith(1);
      expect(logSpy).toHaveBeenCalledWith('Lessons');
      expect(logSpy).toHaveBeenCalledWith(1);
      expect(logSpy).toHaveBeenCalledWith('Preferred transcripts');
      expect(logSpy).toHaveBeenCalledWith('1 VTT');
      expect(logSpy).toHaveBeenCalledWith('Secondary transcripts');
      expect(logSpy).toHaveBeenCalledWith('1 SRT');
      expect(logSpy).toHaveBeenCalledWith('Manifest created successfully.');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should exit with 1 if any manifest fails validation', async () => {
      mockManifestValidator.validate = vi
        .fn()
        .mockReturnValue({ valid: false, errors: ['Missing transcript'] });

      await runManifest(orchestrator);

      expect(logSpy).toHaveBeenCalledWith('Manifest validation failed:');
      expect(logSpy).toHaveBeenCalledWith('  ✗ Missing transcript');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
