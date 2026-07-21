import { describe, it, expect } from 'vitest';
import { ManifestValidator, CourseManifest } from '../src/ingestion/manifest';
import { TranscriptFormat } from '../src/types';
import { ValidationError } from '../src/shared/errors';

describe('ManifestValidator', () => {
  const validator = new ManifestValidator();

  const validManifest: CourseManifest = {
    courseId: 'angular-course',
    courseName: 'Angular Course',
    rootDirectory: '/data/extracted/angular-course',
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
                absolutePath: '/data/extracted/angular-course/01 Introduction/001 Welcome/001 Welcome.vtt',
                relativePath: '01 Introduction/001 Welcome/001 Welcome.vtt',
                format: TranscriptFormat.VTT,
                preferred: true,
                fileSize: 100,
              },
            ],
          },
        ],
      },
    ],
  };

  it('should return valid true for a complete and well-structured manifest', () => {
    const result = validator.validate(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(() => validator.assertValid(validManifest)).not.toThrow();
  });

  it('should detect duplicate lesson IDs inside a module', () => {
    const manifest: CourseManifest = {
      ...validManifest,
      modules: [
        {
          ...validManifest.modules[0],
          lessons: [
            validManifest.modules[0].lessons[0],
            {
              ...validManifest.modules[0].lessons[0],
              lessonName: 'Another Welcome',
            },
          ],
        },
      ],
    };

    const result = validator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Duplicate lesson ID found: '001'");
  });

  it('should detect duplicate module IDs', () => {
    const manifest: CourseManifest = {
      ...validManifest,
      modules: [
        validManifest.modules[0],
        {
          ...validManifest.modules[0],
          lessons: [
            {
              ...validManifest.modules[0].lessons[0],
              lessonId: '002',
            },
          ],
        },
      ],
    };

    const result = validator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Duplicate module ID found: '01'");
  });

  it('should detect empty course without modules', () => {
    const manifest: CourseManifest = {
      ...validManifest,
      modules: [],
    };

    const result = validator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Course manifest must contain at least one module');
  });

  it('should detect empty modules without lessons', () => {
    const manifest: CourseManifest = {
      ...validManifest,
      modules: [
        {
          moduleId: 'empty-mod',
          moduleName: 'Empty Module',
          modulePath: 'empty-mod',
          lessons: [],
        },
      ],
    };

    const result = validator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Module 'Empty Module' contains no lessons");
  });

  it('should detect missing transcript files inside lessons', () => {
    const manifest: CourseManifest = {
      ...validManifest,
      modules: [
        {
          moduleId: '01',
          moduleName: 'Introduction',
          modulePath: '01 Introduction',
          lessons: [
            {
              lessonId: 'no-transcripts',
              lessonName: 'No Transcripts',
              lessonPath: '01 Introduction/no-transcripts',
              transcripts: [],
            },
          ],
        },
      ],
    };

    const result = validator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Lesson 'No Transcripts' (no-transcripts) has no transcript files",
    );
  });

  it('should detect lessons without exactly one preferred transcript', () => {
    const manifest: CourseManifest = {
      ...validManifest,
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
                  fileName: '1.vtt',
                  absolutePath: '/abs/1.vtt',
                  relativePath: 'rel/1.vtt',
                  format: TranscriptFormat.VTT,
                  preferred: false,
                  fileSize: 100,
                },
                {
                  fileName: '1.srt',
                  absolutePath: '/abs/1.srt',
                  relativePath: 'rel/1.srt',
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

    const result = validator.validate(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Lesson '001' must have exactly one preferred transcript (found 0)",
    );
  });

  it('should throw ValidationError when calling assertValid on an invalid manifest', () => {
    const invalidManifest: CourseManifest = {
      ...validManifest,
      modules: [],
    };

    expect(() => validator.assertValid(invalidManifest)).toThrow(ValidationError);
    expect(() => validator.assertValid(invalidManifest)).toThrow(
      'Course manifest validation failed:',
    );
  });
});
