import { ManifestResult } from '@/ingestion/manifest';
import { ParsingResult } from '@/ingestion/parsing';
import { ChunkingResult } from '@/ingestion/chunking';

/**
 * Represents the failure details of an archive during the extraction stage.
 */
export interface ArchiveExtractionFailure {
  /**
   * Name of the archive that failed to extract.
   */
  readonly archiveName: string;

  /**
   * Error message describing why the extraction failed.
   */
  readonly error: string;
}

/**
 * Strongly typed result summarizing the execution of the ingestion workflow.
 */
export interface IngestionResult {
  /**
   * Total number of archives discovered during the workflow.
   */
  readonly totalArchivesDiscovered: number;

  /**
   * Total number of archives that underwent an extraction attempt.
   */
  readonly totalArchivesExtracted: number;

  /**
   * Number of archives that were extracted successfully.
   */
  readonly successfulExtractions: number;

  /**
   * Number of archives that failed during extraction.
   */
  readonly failedExtractions: number;

  /**
   * Total number of course manifests generated.
   */
  readonly totalManifestsGenerated?: number;

  /**
   * Number of manifests that failed validation or construction.
   */
  readonly failedManifests?: number;

  /**
   * List of generated course manifest results.
   */
  readonly manifests?: readonly ManifestResult[];

  /**
   * Total number of course transcripts parsed across generated manifests.
   */
  readonly totalTranscriptsParsed?: number;

  /**
   * Number of courses/manifests that failed transcript parsing.
   */
  readonly failedParsings?: number;

  /**
   * Total number of subtitle cues extracted across all parsed transcripts.
   */
  readonly totalCuesParsed?: number;

  /**
   * List of generated parsing results across course manifests.
   */
  readonly parsingResults?: readonly ParsingResult[];

  /**
   * Total number of semantic chunks generated across all parsed transcripts.
   */
  readonly totalChunksGenerated?: number;

  /**
   * Number of courses/manifests that failed during chunking stage.
   */
  readonly failedChunkings?: number;

  /**
   * List of generated chunking results across courses.
   */
  readonly chunkingResults?: readonly ChunkingResult[];

  /**
   * Overall duration of the ingestion workflow in milliseconds.
   */

  readonly durationMs: number;

  /**
   * Overall success status of the ingestion workflow.
   * True if all discovered archives were extracted successfully without failure.
   */
  readonly success: boolean;

  /**
   * Details of any extraction failures encountered during the workflow.
   */
  readonly failures: readonly ArchiveExtractionFailure[];
}
