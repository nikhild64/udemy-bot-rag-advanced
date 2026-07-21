import { ManifestResult } from '@/ingestion/manifest';

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
