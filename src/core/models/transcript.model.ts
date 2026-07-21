import { TranscriptFormat } from '@/types';

/**
 * Represents an individual timed subtitle cue entry within a transcript.
 */
export interface TranscriptCue {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly text: string;
}

/**
 * Represents a parsed subtitle file associated with a lesson.
 */
export interface Transcript {
  readonly id: string;
  readonly lessonId: string;
  readonly format: TranscriptFormat;
  readonly cues: readonly TranscriptCue[];
}
