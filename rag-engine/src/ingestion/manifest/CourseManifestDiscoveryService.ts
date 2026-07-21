import fs from 'node:fs/promises';
import path from 'node:path';
import { TranscriptFormat } from '@/types';
import { logger } from '@/shared/logger';
import { NotFoundError } from '@/shared/errors';

export interface DiscoveredTranscriptFile {
  readonly fileName: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly format: TranscriptFormat;
  readonly fileSize: number;
}

export interface DiscoveredLesson {
  readonly directoryName: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly transcriptFiles: readonly DiscoveredTranscriptFile[];
}

export interface DiscoveredModule {
  readonly directoryName: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly lessons: readonly DiscoveredLesson[];
}

export interface DiscoveredCourse {
  readonly directoryName: string;
  readonly rootDirectory: string;
  readonly modules: readonly DiscoveredModule[];
}

export interface ICourseManifestDiscoveryService {
  /**
   * Recursively walk the filesystem inside the given course root path and discover modules, lessons, and transcripts.
   */
  discover(courseRootPath: string): Promise<DiscoveredCourse>;

  /**
   * Discover all course directories inside the given extraction root path.
   */
  discoverAll?(extractionRootPath: string): Promise<DiscoveredCourse[]>;
}

export class CourseManifestDiscoveryService implements ICourseManifestDiscoveryService {
  async discover(courseRootPath: string): Promise<DiscoveredCourse> {
    const startTime = Date.now();
    const resolvedRootPath = path.resolve(courseRootPath);
    const directoryName = path.basename(resolvedRootPath);

    logger.info({ courseRootPath: resolvedRootPath, directoryName }, 'Manifest discovery started');

    try {
      const stats = await fs.stat(resolvedRootPath);
      if (!stats.isDirectory()) {
        throw new NotFoundError(`Course extraction path is not a directory: ${resolvedRootPath}`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new NotFoundError(`Course extraction directory not found: ${resolvedRootPath}`, {
        cause: error,
      });
    }

    let effectiveRootPath = resolvedRootPath;
    let rootEntries = await fs.readdir(effectiveRootPath, { withFileTypes: true });

    while (
      rootEntries.filter((e) => !e.name.startsWith('.') && e.isDirectory()).length === 1 &&
      rootEntries.filter(
        (e) =>
          !e.name.startsWith('.') &&
          !e.isDirectory() &&
          (e.name.endsWith('.vtt') || e.name.endsWith('.srt')),
      ).length === 0
    ) {
      const singleDir = rootEntries.find((e) => !e.name.startsWith('.') && e.isDirectory())!;
      const singleDirPath = path.join(effectiveRootPath, singleDir.name);
      if (await this.isWrapperDirectory(singleDirPath)) {
        effectiveRootPath = singleDirPath;
        rootEntries = await fs.readdir(effectiveRootPath, { withFileTypes: true });
      } else {
        break;
      }
    }

    const sortedRootEntries = [...rootEntries].sort((a, b) => a.name.localeCompare(b.name));

    const modules: DiscoveredModule[] = [];
    let totalLessonsDiscovered = 0;
    let totalTranscriptsDiscovered = 0;

    for (const moduleEntry of sortedRootEntries) {
      if (moduleEntry.name.startsWith('.') || !moduleEntry.isDirectory()) {
        continue;
      }

      const moduleAbsolutePath = path.join(effectiveRootPath, moduleEntry.name);
      const moduleRelativePath = path
        .relative(resolvedRootPath, moduleAbsolutePath)
        .replace(/\\/g, '/');

      const moduleEntries = await fs.readdir(moduleAbsolutePath, { withFileTypes: true });
      const sortedModuleEntries = [...moduleEntries].sort((a, b) => a.name.localeCompare(b.name));

      const lessons: DiscoveredLesson[] = [];
      const looseTranscriptMap = new Map<string, DiscoveredTranscriptFile[]>();

      for (const lessonEntry of sortedModuleEntries) {
        if (lessonEntry.name.startsWith('.')) {
          continue;
        }

        if (lessonEntry.isDirectory()) {
          const lessonAbsolutePath = path.join(moduleAbsolutePath, lessonEntry.name);
          const lessonRelativePath = path
            .relative(resolvedRootPath, lessonAbsolutePath)
            .replace(/\\/g, '/');

          const transcriptFiles = await this.findTranscriptsRecursive(
            lessonAbsolutePath,
            lessonRelativePath,
          );
          totalTranscriptsDiscovered += transcriptFiles.length;

          lessons.push({
            directoryName: lessonEntry.name,
            absolutePath: lessonAbsolutePath,
            relativePath: lessonRelativePath,
            transcriptFiles,
          });
          totalLessonsDiscovered++;
        } else {
          // File directly in module directory
          const ext = path.extname(lessonEntry.name).toLowerCase();
          let format: TranscriptFormat;
          if (ext === '.vtt') {
            format = TranscriptFormat.VTT;
          } else if (ext === '.srt') {
            format = TranscriptFormat.SRT;
          } else {
            continue;
          }

          const fileAbsolutePath = path.join(moduleAbsolutePath, lessonEntry.name);
          const fileStats = await fs.stat(fileAbsolutePath);
          const fileRelativePath = path.join(moduleRelativePath, lessonEntry.name).replace(/\\/g, '/');

          const baseName = path.parse(lessonEntry.name).name;
          const transcriptFile: DiscoveredTranscriptFile = {
            fileName: lessonEntry.name,
            absolutePath: fileAbsolutePath,
            relativePath: fileRelativePath,
            format,
            fileSize: fileStats.size,
          };

          if (!looseTranscriptMap.has(baseName)) {
            looseTranscriptMap.set(baseName, []);
          }
          looseTranscriptMap.get(baseName)!.push(transcriptFile);
          totalTranscriptsDiscovered++;
        }
      }

      // Convert loose transcripts in module directory into lessons
      if (looseTranscriptMap.size > 0) {
        const sortedBaseNames = Array.from(looseTranscriptMap.keys()).sort((a, b) =>
          a.localeCompare(b),
        );
        for (const baseName of sortedBaseNames) {
          lessons.push({
            directoryName: baseName,
            absolutePath: moduleAbsolutePath,
            relativePath: moduleRelativePath,
            transcriptFiles: looseTranscriptMap.get(baseName)!,
          });
          totalLessonsDiscovered++;
        }
      }

      modules.push({
        directoryName: moduleEntry.name,
        absolutePath: moduleAbsolutePath,
        relativePath: moduleRelativePath,
        lessons,
      });
    }

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        courseRootPath: resolvedRootPath,
        modulesDiscovered: modules.length,
        lessonsDiscovered: totalLessonsDiscovered,
        transcriptFilesDiscovered: totalTranscriptsDiscovered,
        durationMs,
      },
      'Manifest discovery completed',
    );

    return {
      directoryName,
      rootDirectory: resolvedRootPath,
      modules,
    };
  }

  private async findTranscriptsRecursive(
    currentAbsolutePath: string,
    currentRelativePath: string,
  ): Promise<DiscoveredTranscriptFile[]> {
    const results: DiscoveredTranscriptFile[] = [];
    const entries = await fs.readdir(currentAbsolutePath, { withFileTypes: true });
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sortedEntries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(currentAbsolutePath, entry.name);
      const relPath = path.join(currentRelativePath, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const nested = await this.findTranscriptsRecursive(fullPath, relPath);
        results.push(...nested);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        let format: TranscriptFormat;
        if (ext === '.vtt') {
          format = TranscriptFormat.VTT;
        } else if (ext === '.srt') {
          format = TranscriptFormat.SRT;
        } else {
          continue;
        }

        const fileStats = await fs.stat(fullPath);
        results.push({
          fileName: entry.name,
          absolutePath: fullPath,
          relativePath: relPath,
          format,
          fileSize: fileStats.size,
        });
      }
    }

    return results;
  }

  private async isWrapperDirectory(dirPath: string): Promise<boolean> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const subDirs = entries.filter((e) => !e.name.startsWith('.') && e.isDirectory());
    const files = entries.filter((e) => !e.name.startsWith('.') && !e.isDirectory());

    if (files.some((f) => f.name.endsWith('.vtt') || f.name.endsWith('.srt'))) {
      return false;
    }

    for (const subDir of subDirs) {
      const subDirPath = path.join(dirPath, subDir.name);
      const subEntries = await fs.readdir(subDirPath, { withFileTypes: true });
      if (subEntries.some((e) => !e.name.startsWith('.') && e.isDirectory())) {
        return true;
      }
    }

    return false;
  }

  async discoverAll(extractionRootPath: string): Promise<DiscoveredCourse[]> {
    const resolvedPath = path.resolve(extractionRootPath);
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        throw new NotFoundError(`Extraction path is not a directory: ${resolvedPath}`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundError(`Extraction directory not found: ${resolvedPath}`, {
          cause: error,
        });
      }
      throw error;
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    const discoveredCourses: DiscoveredCourse[] = [];
    for (const entry of sortedEntries) {
      if (entry.name.startsWith('.') || !entry.isDirectory()) {
        continue;
      }
      const courseDir = path.join(resolvedPath, entry.name);
      discoveredCourses.push(await this.discover(courseDir));
    }

    return discoveredCourses;
  }
}
