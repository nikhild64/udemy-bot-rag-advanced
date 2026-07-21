import { TranscriptFormat } from '@/types';

/**
 * Represents an individual timed subtitle cue entry within a transcript.
 */
export interface TranscriptCue {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration?: number;
  readonly text: string;
  readonly order?: number;
}

/**
 * Represents a parsed subtitle file associated with a lesson.
 */
export interface Transcript {
  readonly id: string;
  readonly lessonId: string;
  readonly format: TranscriptFormat;
  readonly language?: string;
  readonly sourceFile?: string;
  readonly totalCues?: number;
  readonly cues: readonly TranscriptCue[];
}

