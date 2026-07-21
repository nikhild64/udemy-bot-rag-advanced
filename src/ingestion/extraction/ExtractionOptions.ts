/**
 * Options for configuring archive extraction.
 */
export interface ExtractionOptions {
  /**
   * Optional base extraction directory or specific destination path.
   * If not provided, configuration default will be used by services.
   */
  readonly destinationDirectory?: string;

  /**
   * Whether to clean existing files in the destination directory before extraction.
   * Defaults to true in ExtractionService.
   */
  readonly cleanBeforeExtract?: boolean;
}
