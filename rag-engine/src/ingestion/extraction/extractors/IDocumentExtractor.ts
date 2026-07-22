export interface ExtractedDocument {
  text: string;
  metadata?: Record<string, any>;
}

export interface IDocumentExtractor {
  extract(fileBuffer: Buffer, mimeType?: string, fileName?: string): Promise<ExtractedDocument>;
}
