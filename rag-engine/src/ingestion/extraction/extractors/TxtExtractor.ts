import { IDocumentExtractor, ExtractedDocument } from './IDocumentExtractor';

export class TxtExtractor implements IDocumentExtractor {
  async extract(fileBuffer: Buffer, _mimeType?: string, fileName?: string): Promise<ExtractedDocument> {
    const text = fileBuffer.toString('utf-8');
    return {
      text,
      metadata: {
        fileName,
        charCount: text.length,
      },
    };
  }
}
