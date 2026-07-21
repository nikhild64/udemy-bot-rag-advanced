import { Chunk } from '../core/models';
import { RetrievalStatistics } from './RetrievalStatistics';
import { Citation } from './Citation';
import { SourceReference } from './SourceReference';

export interface RetrievedChunk {
  chunkId: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
  chunk: Chunk;
  startTime?: number;
  endTime?: number;
  sourceReference: SourceReference;
  citation: Citation;
}

export interface RetrievalResult {
  query: string;
  retrievedChunks: RetrievedChunk[];
  citations: Citation[];
  totalResults: number;
  elapsedTime: number;
  statistics: RetrievalStatistics;
}
