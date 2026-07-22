import { SourceType } from '@prisma/client';
import { RawContent } from './RawContent';

export interface SourceInput {
  id: string;
  notebookId: string;
  type: SourceType | string;
  title: string;
  displayName?: string | null;
  storagePath?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  metadata?: any;
}

export interface ISourceLoader {
  load(source: SourceInput): Promise<RawContent>;
}
