import { TranscriptCue } from '@/core/models';

/**
 * Interface for subtitle and transcript file parsers.
 * Defines the contract for parsing raw content strings into structured cues.
 */
export interface TranscriptParser {
  /**
   * Parses raw transcript text into structured transcript cues with timestamps.
   * @param rawContent Raw subtitle content string (e.g., VTT or SRT file content).
   * @returns Promise resolving to an array of parsed transcript cues.
   */
  parse(rawContent: string): Promise<TranscriptCue[]>;
}
