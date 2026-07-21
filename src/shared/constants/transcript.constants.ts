import { TranscriptFormat } from '@/types';

/**
 * List of currently supported transcript formats.
 */
export const SUPPORTED_TRANSCRIPT_FORMATS: readonly TranscriptFormat[] = [
  TranscriptFormat.VTT,
] as const;
