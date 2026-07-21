import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CourseManifestDiscoveryService } from '../src/ingestion/manifest';
import { TranscriptFormat } from '../src/types';
import { NotFoundError } from '../src/shared/errors';

describe('CourseManifestDiscoveryService', () => {
  let tmpDir: string;
  let service: CourseManifestDiscoveryService;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), `manifest-discovery-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    service = new CourseManifestDiscoveryService();
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should discover single course with multiple modules, lessons, and both VTT/SRT transcripts', async () => {
    const courseDir = path.join(tmpDir, 'angular-course');
    const mod1 = path.join(courseDir, '01 Introduction');
    const lesson1 = path.join(mod1, '001 Welcome');
    const lesson2 = path.join(mod1, '002 Setup');

    await fs.mkdir(lesson1, { recursive: true });
    await fs.mkdir(lesson2, { recursive: true });

    // Lesson 1 has both vtt and srt
    await fs.writeFile(path.join(lesson1, '001 Welcome.vtt'), 'WEBVTT cue 1');
    await fs.writeFile(path.join(lesson1, '001 Welcome.srt'), '1\n00:00:00,000 --> 00:00:01,000\ncue 1');

    // Lesson 2 has only vtt
    await fs.writeFile(path.join(lesson2, '002 Setup.vtt'), 'WEBVTT setup cue');

    const result = await service.discover(courseDir);

    expect(result.directoryName).toBe('angular-course');
    expect(result.rootDirectory).toBe(path.resolve(courseDir));
    expect(result.modules).toHaveLength(1);

    const mod = result.modules[0];
    expect(mod.directoryName).toBe('01 Introduction');
    expect(mod.lessons).toHaveLength(2);

    const l1 = mod.lessons.find((l) => l.directoryName === '001 Welcome');
    expect(l1).toBeDefined();
    expect(l1!.transcriptFiles).toHaveLength(2);

    const vttFile = l1!.transcriptFiles.find((f) => f.format === TranscriptFormat.VTT);
    const srtFile = l1!.transcriptFiles.find((f) => f.format === TranscriptFormat.SRT);

    expect(vttFile).toBeDefined();
    expect(vttFile!.fileName).toBe('001 Welcome.vtt');
    expect(vttFile!.fileSize).toBeGreaterThan(0);

    expect(srtFile).toBeDefined();
    expect(srtFile!.fileName).toBe('001 Welcome.srt');
    expect(srtFile!.fileSize).toBeGreaterThan(0);

    const l2 = mod.lessons.find((l) => l.directoryName === '002 Setup');
    expect(l2).toBeDefined();
    expect(l2!.transcriptFiles).toHaveLength(1);
    expect(l2!.transcriptFiles[0].format).toBe(TranscriptFormat.VTT);
  });

  it('should ignore hidden directories, hidden files, and unsupported file extensions', async () => {
    const courseDir = path.join(tmpDir, 'node-course');
    const modDir = path.join(courseDir, '01 Basics');
    const lessonDir = path.join(modDir, '001 Intro');
    const hiddenModDir = path.join(courseDir, '.hidden-mod');

    await fs.mkdir(lessonDir, { recursive: true });
    await fs.mkdir(hiddenModDir, { recursive: true });

    // Hidden files inside lesson
    await fs.writeFile(path.join(lessonDir, '.DS_Store'), 'hidden');
    // Unsupported files inside lesson
    await fs.writeFile(path.join(lessonDir, 'video.mp4'), 'fake mp4');
    await fs.writeFile(path.join(lessonDir, 'notes.txt'), 'notes');
    // Supported file
    await fs.writeFile(path.join(lessonDir, '001 Intro.srt'), '1\n00:00:00,000 --> 00:00:01,000\nIntro');

    const result = await service.discover(courseDir);

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].directoryName).toBe('01 Basics');
    expect(result.modules[0].lessons).toHaveLength(1);
    expect(result.modules[0].lessons[0].transcriptFiles).toHaveLength(1);
    expect(result.modules[0].lessons[0].transcriptFiles[0].fileName).toBe('001 Intro.srt');
  });

  it('should discover transcripts loose in module directory when no lesson subdirectory exists', async () => {
    const courseDir = path.join(tmpDir, 'loose-course');
    const modDir = path.join(courseDir, '01 LooseModule');

    await fs.mkdir(modDir, { recursive: true });
    await fs.writeFile(path.join(modDir, '001 Lecture.vtt'), 'WEBVTT');
    await fs.writeFile(path.join(modDir, '001 Lecture.srt'), 'SRT');

    const result = await service.discover(courseDir);

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].lessons).toHaveLength(1);
    expect(result.modules[0].lessons[0].directoryName).toBe('001 Lecture');
    expect(result.modules[0].lessons[0].transcriptFiles).toHaveLength(2);
  });

  it('should throw NotFoundError if course extraction directory does not exist', async () => {
    const missingPath = path.join(tmpDir, 'non-existent-course');
    await expect(service.discover(missingPath)).rejects.toThrow(NotFoundError);
  });

  it('should discoverAll across multiple extracted course directories', async () => {
    const extractRoot = path.join(tmpDir, 'extracted-all');
    await fs.mkdir(path.join(extractRoot, 'c1', 'm1', 'l1'), { recursive: true });
    await fs.mkdir(path.join(extractRoot, 'c2', 'm1', 'l1'), { recursive: true });

    await fs.writeFile(path.join(extractRoot, 'c1', 'm1', 'l1', 'l1.vtt'), 'vtt');
    await fs.writeFile(path.join(extractRoot, 'c2', 'm1', 'l1', 'l1.srt'), 'srt');

    const results = await service.discoverAll!(extractRoot);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.directoryName).sort();
    expect(names).toEqual(['c1', 'c2']);
  });
});
