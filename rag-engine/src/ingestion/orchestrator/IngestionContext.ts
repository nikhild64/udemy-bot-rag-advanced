/**
 * Execution context for the ingestion workflow.
 * Encapsulates state, directory configuration, and metadata passed through the pipeline stages.
 */
export interface IngestionContext {
  /**
   * Absolute path to the input directory containing source archives.
   */
  readonly inputDirectory: string;

  /**
   * Absolute path to the destination directory where archives are extracted.
   */
  readonly extractionDirectory: string;

  /**
   * Timestamp recording when the ingestion workflow execution began.
   */
  readonly executionTimestamp: Date;

  /**
   * Whether existing files should be cleaned before extracting archives.
   */
  readonly cleanBeforeExtract?: boolean;

  /**
   * Additional metadata or state accumulated across ingestion phases.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Partial options for initializing the ingestion context when executing workflows.
 */
export type IngestionContextOptions = Partial<IngestionContext>;
