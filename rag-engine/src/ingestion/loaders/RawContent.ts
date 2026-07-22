/**
 * Normalized representation of raw content retrieved by a Source Loader.
 */
export interface RawContent {
  /**
   * Unique identifier of the source.
   */
  sourceId: string;

  /**
   * Source type (e.g. PDF, WEBSITE, YOUTUBE, TEXT, VTT, etc.).
   */
  sourceType: string;

  /**
   * MIME type of the raw content (e.g. application/pdf, text/html, text/vtt, text/plain).
   */
  mimeType: string;

  /**
   * The raw fetched content (buffer or UTF-8 string).
   */
  content: Buffer | string;

  /**
   * Extracted metadata during loading (e.g., file path, URL, HTTP headers, video ID, title).
   */
  metadata: Record<string, any>;
}
