import { RetrievedChunk } from '../../retrieval/RetrievalResult';
import { CRAGEvaluationResult } from '../models/crag.model';

export interface RetrievalEvaluator {
  evaluate(query: string, chunks: RetrievedChunk[]): Promise<CRAGEvaluationResult>;
}
