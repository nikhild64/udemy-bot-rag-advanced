/**
 * Strongly typed result of an archive extraction operation.
 */
export interface ExtractionResult {
  /**
   * Name of the archive file (e.g., 'react-course.zip').
   */
  readonly archiveName: string;

  /**
   * Absolute path to the destination directory where the archive was extracted.
   */
  readonly destinationPath: string;

  /**
   * List of relative paths of the files extracted from the archive.
   */
  readonly filesExtracted: readonly string[];

  /**
   * Duration of the extraction process in milliseconds.
   */
  readonly durationMs: number;

  /**
   * Whether the extraction completed successfully.
   */
  readonly success: boolean;
}
