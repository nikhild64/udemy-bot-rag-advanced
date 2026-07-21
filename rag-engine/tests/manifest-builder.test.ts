import { describe, it, expect } from 'vitest';
import { CourseManifestBuilder, DiscoveredCourse } from '../src/ingestion/manifest';
import { TranscriptFormat } from '../src/types';

describe('CourseManifestBuilder', () => {
  const builder = new CourseManifestBuilder();

  it('should convert DiscoveredCourse to strongly typed CourseManifest and derive clean IDs and names', () => {
    const discovered: DiscoveredCourse = {
      directoryName: 'angular-course',
      rootDirectory: '/data/extracted/angular-course',
      modules: [
        {
          directoryName: '01 Introduction',
          absolutePath: '/data/extracted/angular-course/01 Introduction',
          relativePath: '01 Introduction',
          lessons: [
            {
              directoryName: '001 Welcome',
              absolutePath: '/data/extracted/angular-course/01 Introduction/001 Welcome',
              relativePath: '01 Introduction/001 Welcome',
              transcriptFiles: [
                {
                  fileName: '001 Welcome.vtt',
                  absolutePath: '/data/extracted/angular-course/01 Introduction/001 Welcome/001 Welcome.vtt',
                  relativePath: '01 Introduction/001 Welcome/001 Welcome.vtt',
                  format: TranscriptFormat.VTT,
                  fileSize: 512,
                },
                {
                  fileName: '001 Welcome.srt',
                  absolutePath: '/data/extracted/angular-course/01 Introduction/001 Welcome/001 Welcome.srt',
                  relativePath: '01 Introduction/001 Welcome/001 Welcome.srt',
                  format: TranscriptFormat.SRT,
                  fileSize: 480,
                },
              ],
            },
          ],
        },
      ],
    };

    const manifest = builder.build(discovered);

    expect(manifest.courseId).toBe('angular-course');
    expect(manifest.courseName).toBe('Angular Course');
    expect(manifest.rootDirectory).toBe('/data/extracted/angular-course');
    expect(manifest.modules).toHaveLength(1);

    const mod = manifest.modules[0];
    expect(mod.moduleId).toBe('01');
    expect(mod.moduleName).toBe('Introduction');
    expect(mod.modulePath).toBe('01 Introduction');
    expect(mod.lessons).toHaveLength(1);

    const lesson = mod.lessons[0];
    expect(lesson.lessonId).toBe('001');
    expect(lesson.lessonName).toBe('Welcome');
    expect(lesson.lessonPath).toBe('01 Introduction/001 Welcome');
    expect(lesson.transcripts).toHaveLength(2);

    const vtt = lesson.transcripts.find((t) => t.format === TranscriptFormat.VTT);
    const srt = lesson.transcripts.find((t) => t.format === TranscriptFormat.SRT);

    expect(vtt).toBeDefined();
    expect(vtt!.preferred).toBe(true);

    expect(srt).toBeDefined();
    expect(srt!.preferred).toBe(false);
  });

  it('should mark SRT as preferred when only SRT exists in a lesson', () => {
    const discovered: DiscoveredCourse = {
      directoryName: 'legacy-course',
      rootDirectory: '/data/extracted/legacy-course',
      modules: [
        {
          directoryName: '01 Basics',
          absolutePath: '/data/extracted/legacy-course/01 Basics',
          relativePath: '01 Basics',
          lessons: [
            {
              directoryName: '001 Legacy Lesson',
              absolutePath: '/data/extracted/legacy-course/01 Basics/001 Legacy Lesson',
              relativePath: '01 Basics/001 Legacy Lesson',
              transcriptFiles: [
                {
                  fileName: '001 Legacy Lesson.srt',
                  absolutePath:
                    '/data/extracted/legacy-course/01 Basics/001 Legacy Lesson/001 Legacy Lesson.srt',
                  relativePath: '01 Basics/001 Legacy Lesson/001 Legacy Lesson.srt',
                  format: TranscriptFormat.SRT,
                  fileSize: 300,
                },
              ],
            },
          ],
        },
      ],
    };

    const manifest = builder.build(discovered);
    expect(manifest.modules[0].lessons[0].transcripts[0].preferred).toBe(true);
  });

  it('should format unnumbered directory names neatly when building manifest', () => {
    const discovered: DiscoveredCourse = {
      directoryName: 'my-custom_course',
      rootDirectory: '/data/extracted/my-custom_course',
      modules: [
        {
          directoryName: 'getting_started-module',
          absolutePath: '/data/extracted/my-custom_course/getting_started-module',
          relativePath: 'getting_started-module',
          lessons: [
            {
              directoryName: 'setup-environment',
              absolutePath:
                '/data/extracted/my-custom_course/getting_started-module/setup-environment',
              relativePath: 'getting_started-module/setup-environment',
              transcriptFiles: [],
            },
          ],
        },
      ],
    };

    const manifest = builder.build(discovered);
    expect(manifest.courseId).toBe('my-custom_course');
    expect(manifest.courseName).toBe('My Custom Course');
    expect(manifest.modules[0].moduleId).toBe('getting_started-module');
    expect(manifest.modules[0].moduleName).toBe('Getting Started Module');
    expect(manifest.modules[0].lessons[0].lessonId).toBe('setup-environment');
    expect(manifest.modules[0].lessons[0].lessonName).toBe('Setup Environment');
  });

  it('should use explicit courseId and courseName from options if provided', () => {
    const discovered: DiscoveredCourse = {
      directoryName: 'raw-folder',
      rootDirectory: '/data/extracted/raw-folder',
      modules: [],
    };

    const manifest = builder.build(discovered, {
      courseId: 'CUSTOM_ID',
      courseName: 'Custom Course Title',
    });

    expect(manifest.courseId).toBe('CUSTOM_ID');
    expect(manifest.courseName).toBe('Custom Course Title');
  });
});
