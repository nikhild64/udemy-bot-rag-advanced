import { RawContent } from '../../loaders/RawContent';
import { NormalizedDocument } from '../NormalizedDocument';
import { ExtractedDocument, IDocumentExtractor } from './IDocumentExtractor';

export interface IExtractor extends IDocumentExtractor {
  extract(
    rawContent: RawContent | Buffer | string,
    mimeType?: string,
    fileName?: string,
  ): Promise<NormalizedDocument & ExtractedDocument>;
}
