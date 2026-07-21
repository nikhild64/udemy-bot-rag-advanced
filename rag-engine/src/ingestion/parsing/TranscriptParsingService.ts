import fs from 'node:fs/promises';
import { createHash } from 'crypto';
import { Transcript } from '@/core/models';
import { CourseManifest, ManifestTranscript } from '@/ingestion/manifest';
import { TranscriptFormat } from '@/types';
import { logger } from '@/shared/logger';
import { AppError, NotFoundError, ParsingError } from '@/shared/errors';
import { config } from '@/config';
import { ITranscriptParserFactory, TranscriptParserFactory } from './TranscriptParserFactory';
import { LessonParsingResult, ParsingResult } from './ParsingResult';

export interface ITranscriptParsingService {
  /**
   * Parses all applicable transcripts from a given CourseManifest.
   */
  parseManifest(
    manifest: CourseManifest,
    options?: { parsePreferredOnly?: boolean },
  ): Promise<ParsingResult>;

  /**
   * Parses a specific transcript file path and returns the strongly typed Transcript model.
   */
  parseFile(lessonId: string, absolutePath: string, format?: TranscriptFormat): Promise<Transcript>;
}

export class TranscriptParsingService implements ITranscriptParsingService {
  private readonly parserFactory: ITranscriptParserFactory;

  constructor(parserFactory?: ITranscriptParserFactory) {
    this.parserFactory = parserFactory ?? new TranscriptParserFactory();
  }

  async parseManifest(
    manifest: CourseManifest,
    options?: { parsePreferredOnly?: boolean },
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    const parsePreferredOnly = options?.parsePreferredOnly ?? config.ingestion.parsePreferredOnly;

    logger.info(
      {
        courseId: manifest.courseId,
        modulesCount: manifest.modules.length,
        parsePreferredOnly,
      },
      'Parsing started',
    );

    const transcripts: Transcript[] = [];
    const lessonResults: LessonParsingResult[] = [];
    const errors: string[] = [];
    let lessonsCount = 0;
    let transcriptsAttempted = 0;
    let missingFilesCount = 0;

    for (const mod of manifest.modules) {
      for (const lesson of mod.lessons) {
        lessonsCount++;

        if (lesson.transcripts.length === 0) {
          continue;
        }

        let selectedTranscripts: readonly ManifestTranscript[];
        if (parsePreferredOnly) {
          const preferred = lesson.transcripts.filter((t) => t.preferred);
          selectedTranscripts = preferred.length > 0 ? preferred : lesson.transcripts.slice(0, 1);
        } else {
          selectedTranscripts = lesson.transcripts;
        }

        for (const t of selectedTranscripts) {
          transcriptsAttempted++;
          try {
            const parsedTs = await this.parseFile(lesson.lessonId, t.absolutePath, t.format);
            const transcript: Transcript = {
              ...parsedTs,
              courseId: manifest.courseId,
              moduleId: mod.moduleId,
            };
            transcripts.push(transcript);
            lessonResults.push({
              lessonId: lesson.lessonId,
              lessonName: lesson.lessonName,
              transcriptPath: t.absolutePath,
              format: t.format,
              cuesCount: transcript.cues.length,
              success: true,
              transcript,
              courseId: manifest.courseId,
              moduleId: mod.moduleId,
              moduleName: mod.moduleName,
            });
          } catch (error) {
            if (
              error instanceof NotFoundError ||
              (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
            ) {
              missingFilesCount++;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`[Lesson ${lesson.lessonId}] ${errorMessage}`);
            lessonResults.push({
              lessonId: lesson.lessonId,
              lessonName: lesson.lessonName,
              transcriptPath: t.absolutePath,
              format: t.format,
              cuesCount: 0,
              success: false,
              error: errorMessage,
              courseId: manifest.courseId,
              moduleId: mod.moduleId,
              moduleName: mod.moduleName,
            });
          }
        }
      }
    }

    if (transcriptsAttempted > 0 && missingFilesCount === transcriptsAttempted) {
      throw new NotFoundError(
        `Missing transcript files: all ${missingFilesCount} transcript files for course "${manifest.courseId}" not found on disk`,
      );
    }

    const durationMs = Date.now() - startTime;
    const transcriptsParsedCount = transcripts.length;
    const failedTranscriptsCount = errors.length;
    const totalCuesCount = transcripts.reduce((acc, ts) => acc + ts.cues.length, 0);
    const success = failedTranscriptsCount === 0;

    const result: ParsingResult = {
      courseId: manifest.courseId,
      courseName: manifest.courseName,
      lessonsCount,
      transcriptsParsedCount,
      failedTranscriptsCount,
      totalCuesCount,
      durationMs,
      success,
      transcripts,
      lessonResults,
      errors,
    };

    logger.info(
      {
        courseId: manifest.courseId,
        lessonsCount,
        transcriptsParsedCount,
        failedTranscriptsCount,
        totalCuesCount,
        durationMs,
        success,
      },
      'Transcript parsed',
    );

    return result;
  }

  async parseFile(
    lessonId: string,
    absolutePath: string,
    format?: TranscriptFormat,
  ): Promise<Transcript> {
    const startTime = Date.now();
    const parser = this.parserFactory.getParser(format ?? absolutePath);

    logger.info({ lessonId, absolutePath, format: format ?? absolutePath }, 'Parser selected');

    let rawContent: string;
    try {
      rawContent = await fs.readFile(absolutePath, 'utf-8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundError(`Missing transcript file at path "${absolutePath}"`, {
          cause: error,
          code: 'ENOENT',
        });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ParsingError(
        `Failed to read transcript file at "${absolutePath}": ${errorMessage}`,
        {
          cause: error,
        },
      );
    }

    let cues;
    try {
      cues = await parser.parse(rawContent);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ParsingError(`Error parsing transcript at "${absolutePath}": ${errorMessage}`, {
        cause: error,
      });
    }

    const durationMs = Date.now() - startTime;
    const transcriptFormat =
      format ??
      (absolutePath.toLowerCase().endsWith('.vtt')
        ? TranscriptFormat.VTT
        : TranscriptFormat.SRT);

    const pathHash = createHash('md5').update(absolutePath).digest('hex').substring(0, 8);
    const transcript: Transcript = {
      id: `ts-${lessonId}-${pathHash}`,
      lessonId,
      format: transcriptFormat,
      sourceFile: absolutePath,
      totalCues: cues.length,
      cues,
    };

    logger.info(
      {
        lessonId,
        transcriptId: transcript.id,
        cueCount: cues.length,
        durationMs,
      },
      'Transcript parsed',
    );

    return transcript;
  }
}
