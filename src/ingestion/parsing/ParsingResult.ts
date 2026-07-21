import { Transcript } from '@/core/models';

/**
 * Represents the result of parsing an individual lesson's transcript.
 */
export interface LessonParsingResult {
  readonly lessonId: string;
  readonly lessonName: string;
  readonly transcriptPath: string;
  readonly format: string;
  readonly cuesCount: number;
  readonly success: boolean;
  readonly transcript?: Transcript;
  readonly error?: string;
}

/**
 * Strongly typed result summarizing the parsing of all course transcripts discovered in a CourseManifest.
 */
export interface ParsingResult {
  readonly courseId: string;
  readonly courseName: string;
  readonly lessonsCount: number;
  readonly transcriptsParsedCount: number;
  readonly failedTranscriptsCount: number;
  readonly totalCuesCount: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly transcripts: readonly Transcript[];
  readonly lessonResults: readonly LessonParsingResult[];
  readonly errors: readonly string[];
}
