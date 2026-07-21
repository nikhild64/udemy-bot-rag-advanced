import { TranscriptCue } from '../models';

/**
 * Contract for subtitle and transcript file parsers.
 * Provider-agnostic interface for extracting structured cues from raw transcript strings.
 */
export interface TranscriptParser {
  /**
   * Parses raw transcript text into structured transcript cues with timestamps.
   * @param rawContent Raw subtitle content string (e.g., VTT file content).
   * @returns Promise resolving to an array of parsed transcript cues.
   */
  parse(rawContent: string): Promise<TranscriptCue[]>;
}
