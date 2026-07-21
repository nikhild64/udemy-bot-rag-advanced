import { QueryTransformationResult } from '../models/query-transformation.model';

export interface QueryTransformationStrategy {
  transform(query: string): Promise<QueryTransformationResult>;
}
