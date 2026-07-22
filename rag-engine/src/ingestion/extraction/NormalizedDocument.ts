/**
 * Standardized document structure produced by all Extractors.
 */
export interface NormalizedDocument {
  /**
   * Title of the document or source.
   */
  title: string;

  /**
   * Extracted text content.
   */
  content: string;

  /**
   * Extracted metadata (page, timestamp, heading, language, author, sourceId, etc.).
   */
  metadata: Record<string, any>;
}
