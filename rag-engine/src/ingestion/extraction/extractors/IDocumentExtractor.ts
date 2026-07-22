import { NormalizedDocument } from '../NormalizedDocument';

export interface ExtractedDocument {
  text: string;
  metadata?: Record<string, any>;
}

export interface IDocumentExtractor {
  extract(
    rawContent: any,
    mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument>;
}
