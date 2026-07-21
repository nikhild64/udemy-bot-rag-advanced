import { TranscriptFormat } from '@/types';

/**
 * Represents a discovered transcript file entry within a course manifest.
 */
export interface ManifestTranscript {
  readonly fileName: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly format: TranscriptFormat;
  readonly preferred: boolean;
  readonly fileSize: number;
}

/**
 * Represents a discovered lesson entry within a course manifest.
 */
export interface ManifestLesson {
  readonly lessonId: string;
  readonly lessonName: string;
  readonly lessonPath: string;
  readonly transcripts: readonly ManifestTranscript[];
}

/**
 * Represents a discovered module entry within a course manifest.
 */
export interface ManifestModule {
  readonly moduleId: string;
  readonly moduleName: string;
  readonly modulePath: string;
  readonly lessons: readonly ManifestLesson[];
}

/**
 * Strongly typed canonical representation of an extracted course directory.
 */
export interface CourseManifest {
  readonly courseId: string;
  readonly courseName: string;
  readonly rootDirectory: string;
  readonly modules: readonly ManifestModule[];
}

/**
 * Strongly typed result summarizing the discovery and construction of a course manifest.
 */
export interface ManifestResult {
  readonly courseId: string;
  readonly courseName: string;
  readonly rootDirectory: string;
  readonly modulesCount: number;
  readonly lessonsCount: number;
  readonly transcriptsCount: number;
  readonly preferredTranscriptsCount: number;
  readonly secondaryTranscriptsCount: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly manifest?: CourseManifest;
  readonly validationErrors: readonly string[];
}
